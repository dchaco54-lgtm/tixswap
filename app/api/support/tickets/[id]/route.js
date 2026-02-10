import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

export async function GET(_req, { params }) {
  const id = params?.id;
  if (!id) return NextResponse.json({ error: "Falta id" }, { status: 400 });

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
    .select("id, code, subject, status, kind, created_at, last_message_at, user_id")
    .eq("id", id)
    .single();

  if (tErr) return NextResponse.json({ error: tErr.message }, { status: 500 });
  if (!ticket) return NextResponse.json({ error: "Ticket no encontrado" }, { status: 404 });

  if (ticket.user_id !== user.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { data: messages, error: mErr } = await supabase
    .from("support_messages")
    .select("id, ticket_id, sender_role, sender_user_id, body, created_at")
    .eq("ticket_id", id)
    .order("created_at", { ascending: true });

  if (mErr) return NextResponse.json({ error: mErr.message }, { status: 500 });

  const normalized = (messages || []).map((m) => ({
    ...m,
    body: m.body ?? m.message,
  }));

  return NextResponse.json({ ticket, messages: normalized });
}
