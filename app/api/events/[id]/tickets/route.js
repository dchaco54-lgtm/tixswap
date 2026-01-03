// app/api/events/[id]/tickets/route.js
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

function isAvailableStatus(status) {
  const s = String(status || "").toLowerCase();
  return s === "" || s === "active" || s === "available" || s === "published";
}

async function fetchTickets(admin, eventId) {
  let res = await admin
    .from("tickets")
    .select("id,event_id,price,status,notes,sector,row,seat,created_at")
    .eq("event_id", eventId);

  if (!res.error) return res;

  res = await admin
    .from("tickets")
    .select("id,event_id,price,status,created_at")
    .eq("event_id", eventId);

  return res;
}

export async function GET(req, { params }) {
  try {
    const admin = supabaseAdmin();
    const { id } = params;

    const { data, error } = await fetchTickets(admin, id);
    if (error) {
      return NextResponse.json(
        { error: `No pude cargar tickets: ${error.message}` },
        { status: 500 }
      );
    }

    const tickets = (data || []).filter((t) => isAvailableStatus(t.status));
    return NextResponse.json({ tickets });
  } catch (e) {
    console.error("api/events/[id]/tickets error:", e);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}


