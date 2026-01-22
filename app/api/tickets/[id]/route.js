import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
// PATCH: actualizar status/price/seat/etc (solo si seller_id = user.id)
export async function PATCH(req, { params }) {
  const supabase = createClient(cookies());
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const ticketId = params?.id;
  if (!ticketId) {
    return NextResponse.json({ error: "Falta id" }, { status: 400 });
  }

  const body = await req.json();
  // Solo permitir update de ciertos campos
  const allowed = {};
  if (body.status) allowed.status = body.status;
  if (body.price) allowed.price = body.price;
  if (body.section_label) allowed.section_label = body.section_label;
  if (body.row_label) allowed.row_label = body.row_label;
  if (body.seat_label) allowed.seat_label = body.seat_label;

  // Verificar que el ticket es del usuario
  const { data: ticket, error: ticketError } = await supabase
    .from("tickets")
    .select("id, seller_id, status")
    .eq("id", ticketId)
    .single();
  if (ticketError || !ticket) {
    return NextResponse.json({ error: "Ticket no encontrado" }, { status: 404 });
  }
  if (ticket.seller_id !== user.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  // No permitir editar si está vendido, locked o processing
  if (["sold", "locked", "processing"].includes(ticket.status)) {
    return NextResponse.json({ error: "No se puede editar este ticket en su estado actual." }, { status: 400 });
  }

  const { error: updateError } = await supabase
    .from("tickets")
    .update(allowed)
    .eq("id", ticketId);
  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

// DELETE: eliminar ticket (solo seller_id=user.id y solo en estados permitidos)
export async function DELETE(_req, { params }) {
  const supabase = createClient(cookies());
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const ticketId = params?.id;
  if (!ticketId) {
    return NextResponse.json({ error: "Falta id" }, { status: 400 });
  }

  // Verificar que el ticket es del usuario
  const { data: ticket, error: ticketError } = await supabase
    .from("tickets")
    .select("id, seller_id, status")
    .eq("id", ticketId)
    .single();
  if (ticketError || !ticket) {
    return NextResponse.json({ error: "Ticket no encontrado" }, { status: 404 });
  }
  if (ticket.seller_id !== user.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  // No permitir eliminar si está vendido, locked o processing
  if (["sold", "locked", "processing"].includes(ticket.status)) {
    return NextResponse.json({ error: "No se puede eliminar este ticket en su estado actual." }, { status: 400 });
  }

  const { error: deleteError } = await supabase
    .from("tickets")
    .delete()
    .eq("id", ticketId);
  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export const dynamic = "force-dynamic";

export async function GET(_req, { params }) {
  try {
    const ticketId = params?.id;
    if (!ticketId) {
      return NextResponse.json({ error: "Falta id" }, { status: 400 });
    }

    const admin = supabaseAdmin();

    const { data: ticket, error } = await admin
      .from("tickets")
      .select("id, event_id, price, status, seller_id, created_at, events:events(*)")
      .eq("id", ticketId)
      .single();

    if (error || !ticket) {
      return NextResponse.json(
        { error: error?.message || "Ticket no encontrado" },
        { status: 404 }
      );
    }

    return NextResponse.json({ ticket }, { status: 200 });
  } catch (e) {
    return NextResponse.json(
      { error: "Error interno", details: String(e) },
      { status: 500 }
    );
  }
}
