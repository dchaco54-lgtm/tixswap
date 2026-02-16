// app/support/create/route.js
import { getSupabaseAdmin, getUserFromBearer, getProfileForUser, isAdminUser } from "@/lib/support/auth";
import { createNotification } from "@/lib/notifications";
import { env, sendEmail } from "@/lib/email/resend";
import { templateSupportNewTicketToInbox, templateSupportTicketCreated } from "@/lib/email/templates";

export const runtime = "nodejs";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || "").trim()
  );
}

function extractSupabaseError(err) {
  if (!err) return { message: null, details: null, hint: null, code: null };
  return {
    message: err?.message || null,
    details: err?.details || null,
    hint: err?.hint || null,
    code: err?.code || null,
  };
}

function extractNullColumn(err) {
  const src = String(err?.details || err?.message || "");
  const match = src.match(/null value in column \"([^\"]+)\"/i);
  return match ? match[1] : null;
}

function buildErrorPayload({ fallback, err, isAdmin }) {
  const info = extractSupabaseError(err);
  const nullColumn = extractNullColumn(err);
  return {
    error: fallback,
    message: info.message || null,
    details: info.details || null,
    hint: info.hint || null,
    code: info.code || null,
    null_column: nullColumn,
    is_admin: Boolean(isAdmin),
  };
}

function logSupabaseError(label, err) {
  const info = extractSupabaseError(err);
  const nullColumn = extractNullColumn(err);
  console.error(label, {
    code: info.code,
    message: info.message,
    details: info.details,
    hint: info.hint,
    null_column: nullColumn,
  });
}

export async function POST(req) {
  try {
    const supabaseAdmin = getSupabaseAdmin();

    const { user, error: authErr } = await getUserFromBearer(req, supabaseAdmin);
    if (authErr || !user) return json({ error: "UNAUTHORIZED" }, 401);
    const { ok: isAdmin } = await isAdminUser(supabaseAdmin, user);

    const body = await req.json().catch(() => ({}));
    const rawKind = String(body?.kind || "").toLowerCase().trim();
    const rawCategory = body?.category
      || (rawKind === "dispute" ? "disputa_compra" : rawKind === "support" ? "soporte" : "")
      || "soporte";
    const category = String(rawCategory).trim();
    const subject = String(body?.subject || "").trim();
    const messageText = String(body?.message ?? body?.body ?? body?.text ?? "").trim();
    const orderIdRaw = String(body?.order_id || body?.orderId || "").trim();
    const attachment_ids = Array.isArray(body?.attachment_ids) ? body.attachment_ids : [];

    if (!category) return json({ error: "Falta categoría" }, 400);
    if (!subject) return json({ error: "Falta asunto" }, 400);
    if (!messageText) return json({ error: "Mensaje requerido" }, 400);

    if (orderIdRaw && !isUuid(orderIdRaw)) {
      return json({ error: "Order ID inválido" }, 400);
    }

    const now = new Date().toISOString();

    const profile = await getProfileForUser(supabaseAdmin, user.id);
    const requesterEmail = profile?.email || user.email || null;
    const requesterName = profile?.full_name || null;
    const requesterRut = profile?.rut || null;

    const insertPayload = {
      user_id: user.id,
      status: "open",
      category: category || null,
      subject,
      created_at: now,
      updated_at: now,
      last_message_at: now,
      message: messageText,
      order_id: orderIdRaw || null,
      requester_email: requesterEmail,
      requester_name: requesterName,
      requester_rut: requesterRut,
    };

    const insertTicket = async (payload) => {
      return supabaseAdmin
        .from("support_tickets")
        .insert(payload)
        .select("id, ticket_number, subject, status, category, created_at")
        .single();
    };

    let { data: ticket, error: tErr } = await insertTicket(insertPayload);

    if (tErr || !ticket) {
      logSupabaseError("[support/create] ticket insert failed:", tErr);
      return json(
        buildErrorPayload({
          fallback: "No se pudo crear el ticket.",
          err: tErr,
          isAdmin,
        }),
        500
      );
    }

    // Insert mensaje inicial
    const { data: msg, error: mErr } = await supabaseAdmin
      .from("support_messages")
      .insert({
        ticket_id: ticket.id,
        sender_role: "user",
        sender_user_id: user.id,
        body: messageText,
        created_at: now,
      })
      .select("id")
      .single();

    if (mErr) {
      logSupabaseError("[support/create] message insert failed:", mErr);
      const { error: delErr } = await supabaseAdmin
        .from("support_tickets")
        .delete()
        .eq("id", ticket.id);
      if (delErr) {
        console.error("[support/create] delete ticket failed:", delErr);
      }
      return json(
        buildErrorPayload({
          fallback: "No se pudo crear el ticket.",
          err: mErr,
          isAdmin,
        }),
        500
      );
    }

    if (attachment_ids.length) {
      const { error: aErr } = await supabaseAdmin
        .from("support_attachments")
        .update({ message_id: msg?.id || null, ticket_id: ticket.id })
        .in("id", attachment_ids)
        .eq("ticket_id", ticket.id);

      if (aErr) {
        logSupabaseError("[support/create] attachment update failed:", aErr);
        return json(
          buildErrorPayload({
            fallback: "No se pudieron asociar adjuntos",
            err: aErr,
            isAdmin,
          }),
          500
        );
      }
    }

    const preview = messageText.length > 160 ? `${messageText.slice(0, 160)}…` : messageText;
    const updatePayload = { last_message_at: now, updated_at: now };
    const updateWithPreview = { ...updatePayload, last_message_preview: preview };
    const { error: uErr } = await supabaseAdmin
      .from("support_tickets")
      .update(updateWithPreview)
      .eq("id", ticket.id);

    if (uErr) {
      const isMissingPreview =
        String(uErr?.code || "") === "42703" ||
        String(uErr?.message || "").toLowerCase().includes("last_message_preview");
      if (isMissingPreview) {
        await supabaseAdmin
          .from("support_tickets")
          .update(updatePayload)
          .eq("id", ticket.id);
      } else {
        logSupabaseError("[support/create] ticket update failed:", uErr);
      }
    }

    if (user.id) {
      await createNotification({
        userId: user.id,
        type: "support",
        title: `Ticket creado TS-${ticket.ticket_number}`,
        body: subject,
        link: `/dashboard/tickets?ticketId=${ticket.id}`,
        metadata: { ticketId: ticket.id, ticketNumber: ticket.ticket_number },
      });
    }

    if (requesterEmail) {
      try {
        const baseUrl = (env("NEXT_PUBLIC_SITE_URL") || "https://tixswap.cl").replace(/\/+$/, "");
        const link = `${baseUrl}/dashboard/tickets?ticketId=${ticket.id}`;
        const { subject: mailSubject, html } = templateSupportTicketCreated({
          requesterName,
          ticketNumber: ticket.ticket_number,
          ticketId: ticket.id,
          category,
          subject,
          link,
        });
        await sendEmail({ to: requesterEmail, subject: mailSubject, html });
      } catch (mailErr) {
        console.warn("[support/create] email user error:", mailErr);
      }
    }

    const inbox = env("SUPPORT_INBOX_EMAIL");
    if (inbox) {
      try {
        const baseUrl = (env("NEXT_PUBLIC_SITE_URL") || "https://tixswap.cl").replace(/\/+$/, "");
        const link = `${baseUrl}/admin/soporte`;
        const { subject: mailSubject, html } = templateSupportNewTicketToInbox({
          ticketNumber: ticket.ticket_number,
          subject,
          message: messageText,
          requesterEmail,
          requesterName,
          category,
          link,
        });
        await sendEmail({ to: inbox, subject: mailSubject, html });
      } catch (mailErr) {
        console.warn("[support/create] email inbox error:", mailErr);
      }
    }

    return json(
      { ticket_id: ticket.id, message_id: msg?.id || null, ticket_number: ticket.ticket_number || null },
      200
    );
  } catch (e) {
    return json(
      {
        error: "Unexpected error",
        details: e?.message || String(e),
        hint: null,
        code: null,
      },
      500
    );
  }
}
