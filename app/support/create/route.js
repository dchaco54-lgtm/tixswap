// app/support/create/route.js
import { cookies } from "next/headers";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { getSupabaseAdmin, getProfileForUser } from "@/lib/support/auth";
import { createNotification } from "@/lib/notifications";
import { env, sendEmail } from "@/lib/email/resend";
import { templateSupportNewTicketToInbox, templateSupportTicketCreated } from "@/lib/email/templates";

export const runtime = "nodejs";

const IS_DEV = process.env.NODE_ENV !== "production";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function errorJson(error, status, opts = {}) {
  const payload = {
    error,
    ref: opts.requestId || null,
  };
  if (IS_DEV && opts.debug) {
    payload.debug = opts.debug;
  }
  return json(payload, status);
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || "").trim()
  );
}

function getBearerToken(req) {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : authHeader.trim();
  return token || null;
}

function createBearerClient(token) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("Missing env: NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }
  return createSupabaseClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
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

function buildDebug(err) {
  const info = extractSupabaseError(err);
  const nullColumn = extractNullColumn(err);
  return {
    message: info.message || null,
    details: info.details || null,
    hint: info.hint || null,
    code: info.code || null,
    null_column: nullColumn,
  };
}

function logSupabaseError(label, err, ctx = {}) {
  const info = extractSupabaseError(err);
  const nullColumn = extractNullColumn(err);
  console.error(label, {
    ...ctx,
    code: info.code,
    message: info.message,
    details: info.details,
    hint: info.hint,
    null_column: nullColumn,
  });
  if (info.code === "23502" && nullColumn) {
    console.error("NOT_NULL column failed:", nullColumn);
  }
}

export async function POST(req) {
  let requestId = null;
  try {
    const supabaseAdmin = getSupabaseAdmin();
    requestId =
      globalThis.crypto?.randomUUID?.() ||
      `req_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    const endpoint = "/support/create";

    const cookieStore = cookies();
    const supabaseCookie = createServerClient(cookieStore);
    const { data: cookieData } = await supabaseCookie.auth.getUser();
    let user = cookieData?.user || null;
    let supabaseAuth = supabaseCookie;

    if (!user) {
      const token = getBearerToken(req);
      if (token) {
        const { data: bearerData, error: bearerErr } = await supabaseAdmin.auth.getUser(token);
        if (!bearerErr && bearerData?.user) {
          user = bearerData.user;
          supabaseAuth = createBearerClient(token);
        }
      }
    }

    if (!user) {
      return errorJson("UNAUTHORIZED", 401, { requestId });
    }

    const body = await req.json().catch(() => ({}));
    const rawKind = String(body?.kind || "").toLowerCase().trim();
    const rawCategory = body?.category
      || (rawKind === "dispute" ? "disputa_compra" : rawKind === "support" ? "soporte" : "")
      || "soporte";
    const category = String(rawCategory).trim();
    const subject = String(body?.subject ?? body?.asunto ?? "").trim();
    const messageText = String(body?.message ?? body?.body ?? body?.text ?? "").trim();
    const orderIdRaw = String(body?.order_id || body?.orderId || "").trim();
    const attachment_ids = Array.isArray(body?.attachment_ids) ? body.attachment_ids : [];

    const safePayload = {
      category,
      subject_len: subject.length,
      message_len: messageText.length,
      has_order_id: Boolean(orderIdRaw),
      attachments: attachment_ids.length,
    };

    console.info("[support/create] request", {
      request_id: requestId,
      endpoint,
      user_id: user?.id || null,
      payload: safePayload,
    });

    if (!category) return errorJson("Falta categoría", 400, { requestId });
    if (!subject) return errorJson("Falta asunto", 400, { requestId });
    if (!messageText) return errorJson("Falta mensaje", 400, { requestId });

    if (orderIdRaw && !isUuid(orderIdRaw)) {
      return errorJson("Order ID inválido", 400, { requestId });
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
      return supabaseAuth
        .from("support_tickets")
        .insert(payload)
        .select("id, ticket_number, subject, status, category, created_at")
        .single();
    };

    let { data: ticket, error: tErr } = await insertTicket(insertPayload);

    if (tErr || !ticket) {
      logSupabaseError("create_ticket_error", tErr, {
        request_id: requestId,
        endpoint,
        user_id: user?.id || null,
      });
      return errorJson("No se pudo crear el ticket.", 500, {
        requestId,
        debug: buildDebug(tErr),
      });
    }

    // Insert mensaje inicial
    const { data: msg, error: mErr } = await supabaseAuth
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
      logSupabaseError("[support/create] message insert failed:", mErr, {
        request_id: requestId,
        endpoint,
        user_id: user?.id || null,
        ticket_id: ticket.id,
      });
      const { error: delErr } = await supabaseAdmin
        .from("support_tickets")
        .delete()
        .eq("id", ticket.id);
      if (delErr) {
        console.error("[support/create] delete ticket failed:", delErr);
      }
      return errorJson("No se pudo crear el ticket.", 500, {
        requestId,
        debug: buildDebug(mErr),
      });
    }

    if (attachment_ids.length) {
      const { error: aErr } = await supabaseAdmin
        .from("support_attachments")
        .update({ message_id: msg?.id || null, ticket_id: ticket.id })
        .in("id", attachment_ids)
        .eq("ticket_id", ticket.id);

      if (aErr) {
        logSupabaseError("[support/create] attachment update failed:", aErr, {
          request_id: requestId,
          endpoint,
          user_id: user?.id || null,
          ticket_id: ticket.id,
        });
        return errorJson("No se pudieron asociar adjuntos", 500, {
          requestId,
          debug: buildDebug(aErr),
        });
      }
    }

    const preview = messageText.length > 160 ? `${messageText.slice(0, 160)}…` : messageText;
    const updatePayload = { last_message_at: now, updated_at: now };
    const updateWithPreview = { ...updatePayload, last_message_preview: preview };
    if (ticket?.ticket_number) {
      updateWithPreview.code = `TS-${String(ticket.ticket_number).padStart(4, "0")}`;
    }
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
        logSupabaseError("[support/create] ticket update failed:", uErr, {
          request_id: requestId,
          endpoint,
          user_id: user?.id || null,
          ticket_id: ticket.id,
        });
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
    return errorJson("Unexpected error", 500, {
      requestId,
      debug: buildDebug(e),
    });
  }
}
