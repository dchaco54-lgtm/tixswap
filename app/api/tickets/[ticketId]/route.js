import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

export async function GET(_req, { params }) {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr || !user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const ticketId = params.ticketId;

  const { data: ticket, error: tErr } = await supabase
    .from("support_tickets")
    .select("id, code, subject, status, kind, created_at, last_message_at")
    .eq("id", ticketId)
    .single();

  if (tErr) return NextResponse.json({ error: tErr.message }, { status: 404 });

  // Seguridad: RLS ya limita, pero igual por claridad:
  // si no es del usuario, RLS devolvió null o error.
  if (!ticket) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const { data: messages, error: mErr } = await supabase
    .from("support_messages")
    .select("id, ticket_id, sender_role, sender_user_id, body, created_at")
    .eq("ticket_id", ticketId)
    .order("created_at", { ascending: true });

  if (mErr) return NextResponse.json({ error: mErr.message }, { status: 500 });

  const { data: attachments, error: aErr } = await supabase
    .from("support_attachments")
    .select("id, ticket_id, message_id, storage_path, filename, mime_type, size_bytes, created_at")
    .eq("ticket_id", ticketId)
    .order("created_at", { ascending: true });

  if (aErr) return NextResponse.json({ error: aErr.message }, { status: 500 });

  return NextResponse.json({ ticket, messages: messages ?? [], attachments: attachments ?? [] });
}
