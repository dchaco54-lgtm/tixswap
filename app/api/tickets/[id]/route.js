import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

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
