import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  buildTicketSelect,
  detectTicketColumns,
  normalizeTicket,
} from "@/lib/db/ticketSchema";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;

export async function GET(req, { params }) {
  try {
    const admin = supabaseAdmin();

    const eventId = params?.id;
    if (!eventId) {
      return NextResponse.json({ error: "Falta id de evento" }, { status: 400 });
    }

    const cols = await detectTicketColumns(admin);
    const select = buildTicketSelect(cols);

    const { data: tickets, error: errTickets } = await admin
      .from("tickets")
      .select(select)
      .eq("event_id", eventId)
      // ✅ compat: "available" (nuevo) + "active" (legacy)
      .in("status", ["active", "available"])
      .order("created_at", { ascending: false });

    if (errTickets) {
      return NextResponse.json({ error: errTickets.message }, { status: 500 });
    }

    const normalized = (tickets || []).map((t) => normalizeTicket(t));
    return NextResponse.json({ tickets: normalized });
  } catch (e) {
    return NextResponse.json({ error: e?.message || "Error" }, { status: 500 });
  }
}

