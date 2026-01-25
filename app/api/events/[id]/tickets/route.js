export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  Pragma: "no-cache",
};

export async function GET(_req, { params }) {
  try {
    const eventId = params?.id;
    if (!eventId) {
      return NextResponse.json({ error: "Falta eventId" }, { status: 400, headers: NO_STORE_HEADERS });
    }

    const admin = supabaseAdmin();

    const { data: tickets, error } = await admin
      .from("tickets")
      .select("*")
      .eq("event_id", eventId)
      .in("status", ["active", "available"]) // ✅ aquí está el fix
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500, headers: NO_STORE_HEADERS });
    }

    return NextResponse.json({ tickets: tickets || [] }, { status: 200, headers: NO_STORE_HEADERS });
  } catch (err) {
    console.error("GET /api/events/[id]/tickets error", err);
    return NextResponse.json({ error: "Error" }, { status: 500, headers: NO_STORE_HEADERS });
  }
}


