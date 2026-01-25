// app/api/events/[id]/tickets/route.js
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(request, { params }) {
  try {
    const eventId = params?.id;
    if (!eventId) {
      return NextResponse.json({ error: "Falta eventId" }, { status: 400, headers: { "Cache-Control": "no-store" } });
    }

    const admin = supabaseAdmin();

    const { data, error } = await admin
      .from("tickets")
      .select("id, event_id, price, status, sector, row_label, seat_label, created_at")
      .eq("event_id", eventId)
      .in("status", ["active", "available"]) // 👈 clave
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: "Error al cargar entradas", details: error.message },
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    return NextResponse.json({ tickets: data || [] }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return NextResponse.json(
      { error: "Error inesperado", details: err?.message || String(err) },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}

