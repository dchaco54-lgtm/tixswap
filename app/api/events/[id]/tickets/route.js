import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

export async function GET(_req, { params }) {
  try {
    const eventId = params?.id;
    if (!eventId) {
      return NextResponse.json({ error: "Falta id" }, { status: 400 });
    }

    const admin = supabaseAdmin();

    const { data: tickets, error } = await admin
      .from("tickets")
      .select("id, event_id, price, status, section, row, seat, seller_id, created_at")
      .eq("event_id", eventId)
      .eq("status", "active") // <- CLAVE: publicado = active
      .order("price", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ tickets: tickets ?? [] }, { status: 200 });
  } catch (e) {
    return NextResponse.json(
      { error: "Error interno", details: String(e) },
      { status: 500 }
    );
  }
}

