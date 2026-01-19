import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req, { params }) {
  const id = params?.id;
  if (!id) return NextResponse.json({ error: "Falta id" }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const message = String(body.message ?? "").trim();
  if (!message) return NextResponse.json({ error: "Falta mensaje" }, { status: 400 });

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
      body: message,
    })
    .select("id, ticket_id, sender_role, sender_user_id, body, created_at")
    .single();

  if (mErr) return NextResponse.json({ error: mErr.message }, { status: 500 });

  await admin
    .from("support_tickets")
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", id);

  return NextResponse.json({ message: msg });
}
