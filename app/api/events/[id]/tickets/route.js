export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// GET /api/events/[id]/tickets
export async function GET(_req, { params }) {
  try {
    const eventId = params?.id;
    if (!eventId) {
      return NextResponse.json({ error: "eventId requerido" }, { status: 400 });
    }

    const admin = supabaseAdmin();

    const { data: tickets, error } = await admin
      .from("tickets")
      .select("*")
      .eq("event_id", eventId)
      // ✅ este es el fix: aceptar active y available
      .in("status", ["active", "available"])
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: "Error al obtener tickets", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ tickets: tickets || [] }, { status: 200 });
  } catch (err) {
    console.error("GET /api/events/[id]/tickets error:", err);
    return NextResponse.json(
      { error: "Error inesperado", details: err?.message || "unknown" },
      { status: 500 }
    );
  }
}
