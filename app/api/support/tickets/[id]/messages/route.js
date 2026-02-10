import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sanitizeUserText } from "@/lib/security/sanitize";
import { rateLimitByRequest } from "@/lib/security/rateLimit";

export async function POST(req, { params }) {
  const id = params?.id;
  if (!id) return NextResponse.json({ error: "Falta id" }, { status: 400 });

  let payload = {};
  const contentType = req.headers.get("content-type") || "";
  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    payload = {
      body: form.get("body"),
      message: form.get("message"),
    };
  } else {
    payload = await req.json().catch(() => ({}));
  }

  const content = sanitizeUserText(payload.body ?? payload.message, { maxLen: 3000 });
  if (!content) return NextResponse.json({ error: "Falta mensaje" }, { status: 400 });

  const rate = rateLimitByRequest(req, {
    bucket: `support-ticket-message:${id}`,
    limit: 20,
    windowMs: 60 * 1000,
  });

  if (!rate.ok) {
    return NextResponse.json(
      { error: "Demasiados mensajes. Espera un minuto antes de reintentar." },
      { status: 429 }
    );
  }

  // Autenticación por token
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.replace('Bearer ', '').trim();

  if (!token) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const admin = supabaseAdmin();
  const { data: { user }, error: userErr } = await admin.auth.getUser(token);

  if (userErr || !user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { data: ticket, error: tErr } = await admin
    .from("support_tickets")
    .select("id, user_id")
    .eq("id", id)
    .single();

  if (tErr) return NextResponse.json({ error: tErr.message }, { status: 500 });
  if (!ticket) return NextResponse.json({ error: "Ticket no encontrado" }, { status: 404 });

  if (ticket.user_id !== user.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { data: msg, error: mErr } = await admin
    .from("support_messages")
    .insert({
      ticket_id: id,
      sender_role: "user",
      sender_user_id: user.id,
      body: content,
    })
    .select("id, ticket_id, sender_role, sender_user_id, body, created_at")
    .single();

  if (mErr) return NextResponse.json({ error: mErr.message }, { status: 500 });

  await admin
    .from("support_tickets")
    .update({ last_message_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", id);

  return NextResponse.json({ message: msg });
}
