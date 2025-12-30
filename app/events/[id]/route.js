import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Devuelve el evento (server-side con service role) para evitar dramas de RLS / env.
export async function GET(_req, { params }) {
  const eventId = params?.id;
  if (!eventId) {
    return NextResponse.json({ error: "Falta id" }, { status: 400 });
  }

  const admin = supabaseAdmin();

  const { data: event, error } = await admin
    .from("events")
    .select("*")
    .eq("id", eventId)
    .single();

  if (error) {
    return NextResponse.json(
      { error: error.message || "No se pudo cargar el evento" },
      { status: 500 }
    );
  }

  if (!event) {
    return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });
  }

  return NextResponse.json({ event });
}
