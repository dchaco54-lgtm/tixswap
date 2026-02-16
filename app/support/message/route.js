// app/support/message/route.js
import { createNotification } from "@/lib/notifications";
import { env, sendEmail } from "@/lib/email/resend";
import { templateSupportNewMessageToInbox, templateSupportNewMessageToUser } from "@/lib/email/templates";
import { getSupabaseAdmin, getUserFromBearer, isAdminUser } from "@/lib/support/auth";
import { isTerminalStatus, normalizeStatus, TICKET_STATUS } from "@/lib/support/status";

export const runtime = "nodejs";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(req) {
  try {
    const supabaseAdmin = getSupabaseAdmin();

    const { user, error: authErr } = await getUserFromBearer(req, supabaseAdmin);
    if (authErr || !user) return json({ ok: false, error: "UNAUTHORIZED" }, 401);

    const body = await req.json().catch(() => ({}));
    const ticket_id = body?.ticket_id;
    const messageText = String(body?.message ?? body?.body ?? body?.text ?? "").trim();
    const attachment_ids = Array.isArray(body?.attachment_ids) ? body.attachment_ids : [];
    const reopen = body?.reopen === true;

    if (!ticket_id) return json({ ok: false, error: "Falta ticket_id" }, 400);
    if (!messageText && attachment_ids.length === 0) {
      return json({ ok: false, error: "Mensaje vacío" }, 400);
    }

    // es admin?
    const { ok: isAdmin, profile } = await isAdminUser(supabaseAdmin, user);
    const sender_role = isAdmin ? "admin" : "user";

    // cargar ticket
    const { data: ticket, error: tErr } = await supabaseAdmin
      .from("support_tickets")
      .select("id, user_id, status, ticket_number, subject, requester_email, category")
      .eq("id", ticket_id)
      .single();

    if (tErr || !ticket) return json({ ok: false, error: "Ticket no existe" }, 404);

    // Si el ticket está cerrado, no aceptamos más mensajes (ni usuario ni admin)
    const normalizedStatus = normalizeStatus(ticket.status);
    const isTerminal = isTerminalStatus(normalizedStatus);
    if (isTerminal && !reopen) {
      return json({ ok: false, error: "Este ticket está cerrado" }, 403);
    }

    // permiso: si no es admin, solo su ticket
    if (!isAdmin && ticket.user_id !== user.id) {
      return json({ ok: false, error: "FORBIDDEN" }, 403);
    }

    // insertar mensaje
    const bodyValue = messageText || (attachment_ids.length ? "" : null);
    const { data: msg, error: mErr } = await supabaseAdmin
      .from("support_messages")
      .insert({
        ticket_id,
        sender_role,
        sender_user_id: user.id,
        body: bodyValue,
        created_at: new Date().toISOString(),
      })
      .select("id, ticket_id, sender_role, sender_user_id, body, created_at")
      .single();

    if (mErr) return json({ ok: false, error: "DB insert failed", details: mErr.message }, 500);

    // asociar adjuntos (si vienen)
    let updatedAttachments = [];
    if (attachment_ids.length) {
      const { error: aErr } = await supabaseAdmin
        .from("support_attachments")
        .update({ message_id: msg.id, ticket_id })
        .in("id", attachment_ids)
        .eq("ticket_id", ticket_id);

      if (aErr) {
        return json(
          { ok: false, error: "No se pudieron asociar adjuntos", details: aErr.message },
          500
        );
      }

      const { data: atts } = await supabaseAdmin
        .from("support_attachments")
        .select("id, ticket_id, message_id, storage_path, filename, mime_type, size_bytes, created_at")
        .in("id", attachment_ids)
        .eq("ticket_id", ticket_id);

      updatedAttachments = atts || [];
      for (const a of updatedAttachments) {
        if (!a?.storage_path) {
          a.signed_url = null;
          a.file_name = a.filename;
          a.file_size = a.size_bytes;
          continue;
        }
        const { data: signed } = await supabaseAdmin.storage
          .from("support-attachments")
          .createSignedUrl(a.storage_path, 60 * 60);
        a.signed_url = signed?.signedUrl || null;
        a.file_name = a.filename;
        a.file_size = a.size_bytes;
      }
    }

    // auto-transición de estado
    let nextStatus = normalizedStatus || TICKET_STATUS.OPEN;
    if (reopen && isTerminal && !isAdmin) {
      nextStatus = TICKET_STATUS.OPEN;
    } else if (isAdmin) {
      nextStatus = TICKET_STATUS.WAITING_USER;
    } else if (normalizedStatus === TICKET_STATUS.WAITING_USER) {
      nextStatus = TICKET_STATUS.IN_PROGRESS;
    } else if (normalizedStatus === TICKET_STATUS.IN_PROGRESS) {
      nextStatus = TICKET_STATUS.IN_PROGRESS;
    } else if (normalizedStatus === TICKET_STATUS.OPEN) {
      nextStatus = TICKET_STATUS.OPEN;
    }

    const now = new Date().toISOString();
    const updatePayload = {
      status: nextStatus,
      last_message_at: now,
      updated_at: now,
    };

    if (reopen && isTerminal && !isAdmin) {
      updatePayload.closed_at = null;
      updatePayload.closed_by = null;
    }

    await supabaseAdmin.from("support_tickets").update(updatePayload).eq("id", ticket_id);

    // email: si admin responde => usuario
    if (isAdmin && ticket.requester_email) {
      const baseUrl = (env("NEXT_PUBLIC_SITE_URL") || "https://tixswap.cl").replace(/\/+$/, "");
      const link = `${baseUrl}/dashboard/tickets?ticketId=${ticket.id}`;
      const { subject, html } = templateSupportNewMessageToUser({
        ticketNumber: ticket.ticket_number,
        subject: ticket.subject,
        link,
        message: messageText,
      });

      await sendEmail({ to: ticket.requester_email, subject, html });
    }

    if (isAdmin && ticket.user_id) {
      await createNotification({
        userId: ticket.user_id,
        type: "support",
        title: "Soporte respondió tu ticket",
        body: ticket.subject ? `Asunto: ${ticket.subject}` : null,
        link: `/dashboard/tickets?ticketId=${ticket.id}`,
        metadata: { ticketId: ticket.id, ticketNumber: ticket.ticket_number || null },
      });
    }

    // email opcional: si usuario responde => bandeja soporte
    const inbox = env("SUPPORT_INBOX_EMAIL");
    if (!isAdmin && inbox) {
      const baseUrl = (env("NEXT_PUBLIC_SITE_URL") || "https://tixswap.cl").replace(/\/+$/, "");
      const link = `${baseUrl}/admin/soporte`;
      const { subject, html } = templateSupportNewMessageToInbox({
        ticketNumber: ticket.ticket_number,
        subject: ticket.subject,
        message: messageText,
        requesterEmail: ticket.requester_email || null,
        requesterName: profile?.full_name || user.email || null,
        category: ticket.category || null,
        link,
      });

      await sendEmail({ to: inbox, subject, html });
    }

    return json({
      ok: true,
      message: msg,
      attachments: updatedAttachments,
      status: nextStatus,
    });
  } catch (e) {
    return json(
      { ok: false, error: "Unexpected error", details: e?.message || String(e) },
      500
    );
  }
}
