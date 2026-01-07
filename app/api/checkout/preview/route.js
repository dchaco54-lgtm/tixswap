import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getFees } from "@/lib/fees";

function parseCLP(value) {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return Math.round(value);
  const normalized = String(value).replace(/[^\d]/g, "");
  const n = parseInt(normalized || "0", 10);
  return Number.isFinite(n) ? n : 0;
}

function sellerDisplayName(fullName, fallback = "Vendedor") {
  if (!fullName) return fallback;
  const parts = String(fullName).trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[1].slice(0, 1)}.`;
}

export async function GET(req) {
  try {
    const url = new URL(req.url);
    const ticketId = url.searchParams.get("ticketId") || url.searchParams.get("ticket");

    if (!ticketId) {
      return NextResponse.json({ error: "Falta ticketId" }, { status: 400 });
    }

    const admin = supabaseAdmin();

    const { data: ticket, error: tErr } = await admin
      .from("tickets")
      .select("id, event_id, seller_id, price, sector, row, seat, status")
      .eq("id", ticketId)
      .maybeSingle();

    if (tErr) {
      return NextResponse.json({ error: "Error leyendo ticket", details: tErr.message }, { status: 500 });
    }
    if (!ticket) {
      return NextResponse.json({ error: "Ticket no encontrado" }, { status: 404 });
    }

    const status = String(ticket.status || "active").toLowerCase().trim();
    if (status !== "active") {
      return NextResponse.json({ error: "Ticket no disponible" }, { status: 409 });
    }

    const { data: event, error: eErr } = await admin
      .from("events")
      .select("id, title, city, venue")
      .eq("id", ticket.event_id)
      .maybeSingle();

    if (eErr) {
      return NextResponse.json({ error: "Error leyendo evento", details: eErr.message }, { status: 500 });
    }
    if (!event) {
      return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });
    }

    let seller = null;
    if (ticket.seller_id) {
      const { data: prof } = await admin
        .from("profiles")
        .select("id, full_name")
        .eq("id", ticket.seller_id)
        .maybeSingle();

      if (prof) {
        seller = {
          id: prof.id,
          full_name: prof.full_name,
          displayName: sellerDisplayName(prof.full_name),
        };
      }
    }

    const ticketPrice = parseCLP(ticket.price);
    const fees = getFees(ticketPrice);

    return NextResponse.json({
      ticket,
      event,
      seller,
      ticketPrice,
      serviceFee: fees.buyerFee,
      total: fees.total,
      commissionPct: fees.buyerRate,
    });
  } catch (e) {
    console.error("checkout/preview error:", e);
    return NextResponse.json({ error: e?.message || "Error interno." }, { status: 500 });
  }
}
