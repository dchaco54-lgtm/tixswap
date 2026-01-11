import { NextResponse } from "next/server";
import supabaseAdmin from "@/lib/supabaseAdmin";

// Devuelve tickets (entradas) para un evento.
// BD usa: sector / row_label / seat_label
// Front espera: section / row / seat (legacy)
export async function GET(_req, { params }) {
  try {
    const eventId = params?.id;
    if (!eventId) {
      return NextResponse.json({ error: "Missing event id" }, { status: 400 });
    }

    const supabase = supabaseAdmin();

    let { data: tickets, error } = await supabase
      .from("tickets")
      .select(
        "id,event_id,price,status,created_at,sector,row_label,seat_label,title,description,seller_id,seller_name,seller_email,seller_rut"
      )
      .eq("event_id", eventId)
      .eq("status", "active")
      .order("created_at", { ascending: false });

    // fallback ultra simple (por si algo raro pasa)
    if (error) {
      const fallback = await supabase
        .from("tickets")
        .select("id,event_id,price,status,created_at,sector,row_label,seat_label,seller_id,seller_name")
        .eq("event_id", eventId)
        .eq("status", "active")
        .order("created_at", { ascending: false });

      tickets = fallback.data || [];
      error = fallback.error;
    }

    if (error) {
      console.error("[api/events/:id/tickets] error:", error);
      return NextResponse.json(
        { tickets: [], count: 0, warning: error.message || "Error loading tickets" },
        { status: 200 }
      );
    }

    const normalized = (tickets || []).map((t) => ({
      ...t,
      section: t.sector ?? null,
      row: t.row_label ?? null,
      seat: t.seat_label ?? null,
      notes: t.description ?? null
    }));

    return NextResponse.json({ tickets: normalized, count: normalized.length }, { status: 200 });
  } catch (e) {
    console.error("[api/events/:id/tickets] exception:", e);
    return NextResponse.json({ tickets: [], count: 0, error: "Server error" }, { status: 500 });
  }
}
