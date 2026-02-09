// app/support/message/route.js
import { createClient } from "@supabase/supabase-js";
import { createNotification } from "@/lib/notifications";

export const runtime = "nodejs";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function env(name) {
  const v = process.env[name];
  return v && String(v).trim().length ? String(v).trim() : null;
}

async function sendResendEmail({ to, subject, html }) {
  const key = env("RESEND_API_KEY");
  const from = env("SUPPORT_FROM_EMAIL") || "soporte@tixswap.cl";
  if (!key) return { ok: false, skipped: true };

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to, subject, html }),
  });

  if (!res.ok) {
    const t = await res.text().catch(() => "");
    return { ok: false, error: t || "Resend error" };
  }
  return { ok: true };
}

export async function POST(req) {
  try {
    const supabaseUrl = env("NEXT_PUBLIC_SUPABASE_URL");
    const serviceKey = env("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) return json({ ok: false, error: "Missing env" }, 500);

    const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    // auth user
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) return json({ ok: false, error: "UNAUTHORIZED" }, 401);

    const { data: u, error: uErr } = await supabaseAdmin.auth.getUser(token);
    if (uErr || !u?.user) return json({ ok: false, error: "UNAUTHORIZED" }, 401);
    const user = u.user;

    const body = await req.json().catch(() => ({}));
    const ticket_id = body?.ticket_id;
    const messageText = String(body?.body ?? body?.text ?? "").trim();
    const attachment_ids = Array.isArray(body?.attachment_ids) ? body.attachment_ids : [];

    if (!ticket_id) return json({ ok: false, error: "Missing ticket_id" }, 400);
    if (!messageText && attachment_ids.length === 0) {
      return json({ ok: false, error: "Mensaje vacío" }, 400);
    }

    // es admin?
    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    const isAdmin = prof?.role === "admin";
    const sender_role = isAdmin ? "admin" : "user";

    // cargar ticket
    const { data: ticket, error: tErr } = await supabaseAdmin
      .from("support_tickets")
      .select("id, user_id, status, ticket_number, subject, requester_email")
      .eq("id", ticket_id)
      .single();

    if (tErr || !ticket) return json({ ok: false, error: "Ticket no existe" }, 404);

    // Si el ticket está cerrado, no aceptamos más mensajes (ni usuario ni admin)
    if (ticket.status === "resolved" || ticket.status === "rejected") {
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
      })
      .select("id, ticket_id, sender_role, sender_user_id, body, created_at")
      .single();

    if (mErr) return json({ ok: false, error: "DB insert failed", details: mErr.message }, 500);

    // asociar adjuntos (si vienen)
    if (attachment_ids.length) {
      const { error: aErr } = await supabaseAdmin
        .from("support_attachments")
        .update({ message_id: msg.id, ticket_id })
        .in("id", attachment_ids)
        .eq("ticket_id", ticket_id);

      if (aErr) console.warn("attach update error", aErr);
    }

    // auto-transición de estado
    let nextStatus = ticket.status;
    if (isAdmin) {
      if (ticket.status === "submitted" || ticket.status === "waiting_user") nextStatus = "in_review";
    } else {
      if (ticket.status === "waiting_user") nextStatus = "in_review";
    }

    await supabaseAdmin
      .from("support_tickets")
      .update({
        status: nextStatus,
        last_message_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", ticket_id);

    // email: si admin responde => usuario
    if (isAdmin && ticket.requester_email) {
      const link = env("NEXT_PUBLIC_SITE_URL")
        ? `${env("NEXT_PUBLIC_SITE_URL")}/dashboard/tickets`
        : null;

      await sendResendEmail({
        to: ticket.requester_email,
        subject: `TixSwap · Respondimos tu ticket TS-${ticket.ticket_number}`,
        html: `
          <div style="font-family:Arial,sans-serif;line-height:1.5">
            <h2 style="margin:0 0 12px">Respondimos tu ticket TS-${ticket.ticket_number}</h2>
            <p><b>Asunto:</b> ${escapeHtml(ticket.subject || "")}</p>
            <p>Tienes una nueva respuesta de soporte.</p>
            ${link ? `<p><a href="${link}">Ver ticket en TixSwap</a></p>` : ""}
            <p style="color:#666;font-size:12px;margin-top:16px">Este correo es automático.</p>
          </div>
        `,
      });
    }

    if (isAdmin && ticket.user_id) {
      await createNotification({
        userId: ticket.user_id,
        type: "support",
        title: "Soporte respondió tu ticket",
        body: ticket.subject ? `Asunto: ${ticket.subject}` : null,
        link: `/dashboard/soporte/${ticket.id}`,
        metadata: { ticketId: ticket.id, ticketNumber: ticket.ticket_number || null },
      });
    }

    // email opcional: si usuario responde => bandeja soporte
    const inbox = env("SUPPORT_INBOX_EMAIL");
    if (!isAdmin && inbox) {
      await sendResendEmail({
        to: inbox,
        subject: `TixSwap · Usuario respondió TS-${ticket.ticket_number}`,
        html: `
          <div style="font-family:Arial,sans-serif;line-height:1.5">
            <h2 style="margin:0 0 12px">Respuesta del usuario (TS-${ticket.ticket_number})</h2>
            <p><b>Asunto:</b> ${escapeHtml(ticket.subject || "")}</p>
            <p>${escapeHtml(messageText || "").replace(/\n/g, "<br/>")}</p>
          </div>
        `,
      });
    }

    const message = msg
      ? {
          ...msg,
          sender_type: msg.sender_role,
          sender_id: msg.sender_user_id,
        }
      : msg;

    return json({ ok: true, message, status: nextStatus });
  } catch (e) {
    return json(
      { ok: false, error: "Unexpected error", details: e?.message || String(e) },
      500
    );
  }
}

function escapeHtml(str) {
  return String(str || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
