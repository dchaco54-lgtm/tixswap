import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function parseCLP(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (value == null) return 0;
  const digits = String(value).replace(/[^0-9]/g, "");
  const n = Number(digits);
  return Number.isFinite(n) ? n : 0;
}

function pickFirst(...vals) {
  for (const v of vals) {
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return null;
}

function isBuyableStatus(status) {
  const s = String(status || "").toLowerCase().trim();
  if (!s) return true;
  return ["available", "published", "active", "listed"].includes(s);
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const ticketId = searchParams.get("ticketId");

    if (!ticketId) {
      return NextResponse.json({ error: "ticketId requerido" }, { status: 400 });
    }

    // Cliente normal solo para validar sesión del usuario
    const supabase = createRouteHandlerClient({ cookies });

    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();

    if (authErr || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    // supabaseAdmin es FUNCIÓN => hay que ejecutarla
    const admin = supabaseAdmin();

    // Comisión fija TixSwap (comprador): 2.5%
    const buyerRate = 0.025;

    const { data: ticket, error: tErr } = await admin
      .from("tickets")
      .select("*")
      .eq("id", ticketId)
      .maybeSingle();

    if (tErr)
      return NextResponse.json({ error: "Error leyendo ticket" }, { status: 500 });
    if (!ticket)
      return NextResponse.json({ error: "Ticket no encontrado" }, { status: 404 });

    if (!isBuyableStatus(ticket.status))
      return NextResponse.json({ error: "Ticket no disponible" }, { status: 409 });

    let event = null;
    if (ticket.event_id) {
      const { data: ev } = await admin
        .from("events")
        .select("*")
        .eq("id", ticket.event_id)
        .maybeSingle();
      event = ev || null;
    }

    const sellerId = pickFirst(ticket.seller_id, ticket.owner_id, ticket.user_id);
    let seller = null;

    if (sellerId) {
      const { data: s } = await admin
        .from("profiles")
        .select("id, full_name, email, rating_avg, rating_count")
        .eq("id", sellerId)
        .maybeSingle();
      seller = s || null;
    }

    const priceRaw = pickFirst(ticket.price, ticket.value, ticket.amount, ticket.price_clp);
    const ticketPrice = parseCLP(priceRaw);
    const serviceFee = Math.round(ticketPrice * buyerRate);
    const total = ticketPrice + serviceFee;

    return NextResponse.json({
      ticketId,
      feeRate: buyerRate,
      ticketPrice,
      serviceFee,
      total,
      ticket: {
        id: ticket.id,
        location: pickFirst(ticket.location, ticket.ubication, ticket.ubicacion),
        sector: pickFirst(ticket.sector, ticket.section, ticket.zone),
        row: pickFirst(ticket.row),
        seat: pickFirst(ticket.seat),
      },
      event: event
        ? {
            id: event.id,
            title: pickFirst(event.title, event.name),
            city: pickFirst(event.city),
            venue: pickFirst(event.venue),
            date: pickFirst(event.date),
          }
        : null,
      seller: seller
        ? {
            id: seller.id,
            full_name: pickFirst(seller.full_name, seller.email),
            rating_avg: seller.rating_avg,
            rating_count: seller.rating_count,
          }
        : null,
    });
  } catch (e) {
    return NextResponse.json({ error: "Error al obtener resumen" }, { status: 500 });
  }
}
