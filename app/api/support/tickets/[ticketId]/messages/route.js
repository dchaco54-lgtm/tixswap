import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

export async function POST(req, { params }) {
  const ticketId = params?.ticketId;

  if (!ticketId) {
    return NextResponse.json({ error: "Falta ticketId" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const message = String(body.message ?? "").trim();
  if (!message) return NextResponse.json({ error: "Falta mensaje" }, { status: 400 });

  const supabase = createRouteHandlerClient({ cookies });
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();

  if (userErr || !user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { data: ticket, error: tErr } = await supabase
    .from("support_tickets")
    .select("id, user_id")
    .eq("id", ticketId)
    .single();

  if (tErr) return NextResponse.json({ error: tErr.message }, { status: 500 });
  if (!ticket) return NextResponse.json({ error: "Ticket no encontrado" }, { status: 404 });

  if (ticket.user_id !== user.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { data: msg, error: mErr } = await supabase
    .from("support_messages")
    .insert({
      ticket_id: ticketId,
      sender_role: "user",
      sender_user_id: user.id,
      body: message,
    })
    .select("id, ticket_id, sender_role, sender_user_id, body, created_at")
    .single();

  if (mErr) return NextResponse.json({ error: mErr.message }, { status: 500 });

  await supabase
    .from("support_tickets")
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", ticketId);

  return NextResponse.json({ message: msg });
}
