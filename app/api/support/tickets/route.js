import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sanitizeUserText } from "@/lib/security/sanitize";
import { rateLimitByRequest } from "@/lib/security/rateLimit";

function makeCode(n) {
  return `TS-${String(n).padStart(4, "0")}`;
}

export async function GET(req) {
  // Autenticación por token (más confiable que cookies)
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

  const { data, error } = await admin
    .from("support_tickets")
    .select("id, code, subject, status, kind, created_at, last_message_at")
    .eq("user_id", user.id)
    .order("last_message_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ tickets: data ?? [] });
}

export async function POST(req) {
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

  const rate = rateLimitByRequest(req, {
    bucket: "support-ticket-create",
    limit: 10,
    windowMs: 10 * 60 * 1000,
  });

  if (!rate.ok) {
    return NextResponse.json(
      { error: "Demasiados tickets en poco tiempo. Intenta nuevamente en unos minutos." },
      { status: 429 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const subject = sanitizeUserText(body.subject, { maxLen: 180 });
  const message = sanitizeUserText(body.body ?? body.message, { maxLen: 3000 });
  const kind = body.kind === "dispute" ? "dispute" : "support";

  if (!subject) return NextResponse.json({ error: "Falta asunto" }, { status: 400 });
  if (!message) return NextResponse.json({ error: "Falta mensaje" }, { status: 400 });

  const { count } = await admin
    .from("support_tickets")
    .select("id", { count: "exact", head: true });

  const code = makeCode((count ?? 0) + 1000);

  const { data: ticket, error: tErr } = await admin
    .from("support_tickets")
    .insert({
      code,
      user_id: user.id,
      kind,
      subject,
      status: "in_review",
    })
    .select("id, code, subject, status, kind, created_at")
    .single();

  if (tErr) return NextResponse.json({ error: tErr.message }, { status: 500 });

  const { error: mErr } = await admin.from("support_messages").insert({
    ticket_id: ticket.id,
    sender_role: "user",
    sender_user_id: user.id,
    body: message,
  });

  if (mErr) return NextResponse.json({ error: mErr.message }, { status: 500 });

  // Notificación por correo (opcional)
  try {
    await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/support/notify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: ticket.code,
        subject: ticket.subject,
        kind: ticket.kind,
      }),
    });
  } catch {}

  return NextResponse.json({ ticket });
}
