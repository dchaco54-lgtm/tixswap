// app/api/events/[id]/tickets/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(req, { params }) {
  try {
    const eventId = params?.id;
    if (!eventId) {
      return NextResponse.json({ error: "Falta id del evento" }, { status: 400 });
    }

    const admin = supabaseAdmin();

    const { data, error } = await admin
      .from("tickets")
      .select("id, event_id, status, price, original_price, sector, row_label, seat_label, notes, created_at")
      .eq("event_id", eventId)
      // ✅ antes: .eq("status","active")
      .in("status", ["active", "available"])
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ tickets: data || [] }, { status: 200 });
  } catch (e) {
    return NextResponse.json({ error: e.message || "Error interno" }, { status: 500 });
  }
}
