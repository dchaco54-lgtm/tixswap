import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Lista tickets disponibles para un evento (server-side)
// Importante: filtramos por status = 'active' para que solo aparezcan publicaciones vigentes.
export async function GET(_req, { params }) {
  const eventId = params?.id;
  if (!eventId) {
    return NextResponse.json({ error: "Falta id" }, { status: 400 });
  }

  const admin = supabaseAdmin();

  const { data: tickets, error } = await admin
    .from("tickets")
    .select("*")
    .eq("event_id", eventId)
    .eq("status", "active")
    .order("price_clp", { ascending: true });

  if (error) {
    return NextResponse.json(
      { error: error.message || "No se pudieron cargar tickets" },
      { status: 500 }
    );
  }

  return NextResponse.json({ tickets: tickets || [] });
}
