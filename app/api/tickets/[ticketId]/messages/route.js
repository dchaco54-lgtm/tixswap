import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { CAN_CHAT_STATUSES } from "@/lib/support/status";

const BUCKET = "support_attachments";

function safeName(name = "archivo") {
  return name.replace(/[^\w.\-]+/g, "_").slice(0, 120);
}

export async function POST(req, { params }) {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr || !user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const ticketId = params.ticketId;

  // Ver ticket + status (RLS asegura pertenencia)
  const { data: ticket, error: tErr } = await supabase
    .from("support_tickets")
    .select("id, user_id, status, code")
    .eq("id", ticketId)
    .single();

  if (tErr || !ticket) return NextResponse.json({ error: "Ticket no encontrado" }, { status: 404 });

  if (!CAN_CHAT_STATUSES.has(ticket.status)) {
    return NextResponse.json({ error: "Este ticket está cerrado, solo lectura." }, { status: 403 });
  }

  const form = await req.formData();
  const body = String(form.get("body") ?? "").trim();

  // files: puede venir 0..n
  const files = form.getAll("files");

  if (!body && (!files || files.length === 0)) {
    return NextResponse.json({ error: "Escribe un mensaje o adjunta un archivo." }, { status: 400 });
  }

  // 1) Crear mensaje
  const { data: msg, error: mErr } = await supabase
    .from("support_messages")
    .insert({
      ticket_id: ticketId,
      sender_role: "user",
      sender_user_id: user.id,
      body: body || null,
    })
    .select("id, created_at")
    .single();

  if (mErr) return NextResponse.json({ error: mErr.message }, { status: 500 });

  // 2) Subir adjuntos (usamos service role para Storage)
  const admin = supabaseAdmin();
  const insertedAttachments = [];

  for (const f of files) {
    if (!f || typeof f === "string") continue;

    const arrayBuffer = await f.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const filename = safeName(f.name);
    const path = `${ticketId}/${msg.id}/${crypto.randomUUID()}_${filename}`;

    const { error: upErr } = await admin.storage
      .from(BUCKET)
      .upload(path, buffer, {
        contentType: f.type || "application/octet-stream",
        upsert: false,
      });

    if (upErr) {
      return NextResponse.json({ error: `Error subiendo ${filename}: ${upErr.message}` }, { status: 500 });
    }

    const { data: att, error: aErr } = await supabase
      .from("support_attachments")
      .insert({
        ticket_id: ticketId,
        message_id: msg.id,
        storage_path: path,
        filename,
        mime_type: f.type || null,
        size_bytes: buffer.length,
      })
      .select("*")
      .single();

    if (aErr) return NextResponse.json({ error: aErr.message }, { status: 500 });
    insertedAttachments.push(att);
  }

  // 3) Actualizar last_message_at
  await supabase
    .from("support_tickets")
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", ticketId);

  return NextResponse.json({ ok: true, message: msg, attachments: insertedAttachments });
}
