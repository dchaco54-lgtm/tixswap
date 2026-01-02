export const runtime = "nodejs";

// app/api/checkout/preview/route.js
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getFees } from "@/lib/fees";

function getBearerToken(req) {
  const h = req.headers.get("authorization") || "";
  if (!h.toLowerCase().startsWith("bearer ")) return null;
  return h.slice(7).trim();
}

export async function GET(req) {
  try {
    const url = new URL(req.url);
    const ticketId = url.searchParams.get("ticketId") || url.searchParams.get("ticket");

    if (!ticketId) {
      return NextResponse.json({ error: "Falta ticketId" }, { status: 400 });
    }

    const admin = supabaseAdmin();

    // Auth (Bearer)
    const token = getBearerToken(req);
    if (!token) {
      return NextResponse.json({ error: "No autenticado (sin token)." }, { status: 401 });
    }

    const { data: userRes, error: uErr } = await admin.auth.getUser(token);
    const user = userRes?.user;
    if (uErr || !user) {
      return NextResponse.json({ error: "No autenticado." }, { status: 401 });
    }

    // Leer ticket (service role, evita RLS)
    const { data: ticket, error: tErr } = await admin
      .from("tickets")
      .select("*")
      .eq("id", ticketId)
      .maybeSingle();

    if (tErr) {
      return NextResponse.json(
        { error: "Error leyendo ticket", details: tErr.message },
        { status: 500 }
      );
    }

    if (!ticket) {
      return NextResponse.json({ error: "Ticket no encontrado" }, { status: 404 });
    }

    const status = (ticket.status ?? "active").toString().toLowerCase().trim();
    if (status !== "active") {
      return NextResponse.json({ error: "Ticket no disponible" }, { status: 400 });
    }

    // Leer evento
    const { data: event, error: eErr } = await admin
      .from("events")
      .select("*")
      .eq("id", ticket.event_id)
      .maybeSingle();

    if (eErr) {
      return NextResponse.json(
        { error: "Error leyendo evento", details: eErr.message },
        { status: 500 }
      );
    }

    if (!event) {
      return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });
    }

    const feeBreakdown = getFees(ticket.price);

    return NextResponse.json({
      ticket,
      event,
      feeBreakdown,
    });
  } catch (e) {
    console.error("checkout/preview error:", e);
    return NextResponse.json({ error: e?.message || "Error interno." }, { status: 500 });
  }
}
