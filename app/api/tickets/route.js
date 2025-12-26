import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function makeCode(n) {
  return `TS-${String(n).padStart(4, "0")}`;
}

export async function GET() {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr || !user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { data, error } = await supabase
    .from("support_tickets")
    .select("id, code, subject, status, kind, created_at, last_message_at")
    .eq("user_id", user.id)
    .order("last_message_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ tickets: data ?? [] });
}

export async function POST(req) {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr || !user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const subject = String(body.subject ?? "").trim();
  const message = String(body.message ?? "").trim();
  const kind = (body.kind === "dispute" ? "dispute" : "support");

  if (!subject) return NextResponse.json({ error: "Falta asunto" }, { status: 400 });
  if (!message) return NextResponse.json({ error: "Falta mensaje" }, { status: 400 });

  // Generar correlativo simple (V1): cuenta tickets + 1000.
  // (Si quieres robusto, usa sequence en Postgres.)
  const { count } = await supabase
    .from("support_tickets")
    .select("id", { count: "exact", head: true });

  const code = makeCode((count ?? 0) + 1000);

  const { data: ticket, error: tErr } = await supabase
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

  const { error: mErr } = await supabase
    .from("support_messages")
    .insert({
      ticket_id: ticket.id,
      sender_role: "user",
      sender_user_id: user.id,
      body: message,
    });

  if (mErr) return NextResponse.json({ error: mErr.message }, { status: 500 });

  // Notificación por correo (opcional)
  try {
    const admin = supabaseAdmin();
    await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/support/notify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: ticket.code,
        subject: ticket.subject,
        kind: ticket.kind,
      }),
    });
    // si falla, no rompemos creación
    void admin;
  } catch {}

  return NextResponse.json({ ticket });
}
