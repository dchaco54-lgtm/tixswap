import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getFees } from "@/lib/fees";

// Endpoint que alimenta /checkout/[ticketId]
// Importante: en la BD NO existe events.date / events.time.
// El evento usa starts_at (timestamp). Aquí lo normalizamos para el front.

function splitLocation(location) {
  if (!location) return { venue: "", city: "" };
  const parts = location.split(",").map((s) => s.trim());
  if (parts.length === 1) return { venue: parts[0], city: "" };
  return { venue: parts[0], city: parts.slice(1).join(", ") };
}

function formatEventDateTime(startsAt) {
  if (!startsAt) return { date: "", time: "" };
  const d = new Date(startsAt);
  const date = new Intl.DateTimeFormat("es-CL", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(d);
  const time = new Intl.DateTimeFormat("es-CL", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
  return { date, time };
}

async function buildPreview(ticketId) {
  const supabase = createSupabaseAdmin();

  // 1) Ticket + evento
  const { data: ticket, error: tErr } = await supabase
    .from("tickets")
    .select(
      `
      id,
      title,
      price,
      currency,
      sector,
      row_label,
      seat_label,
      description,
      seller_id,
      event_id,
      events (
        id,
        name,
        location,
        starts_at,
        image_url
      )
    `
    )
    .eq("id", ticketId)
    .single();

  if (tErr || !ticket) {
    return { error: tErr?.message || "Ticket no encontrado" };
  }

  const ev = ticket.events;
  const { venue, city } = splitLocation(ev?.location);
  const { date, time } = formatEventDateTime(ev?.starts_at);

  const ticketPrice = Number(ticket.price) || 0;

  // 2) Fee TixSwap: 2.5% mínimo $1.200
  const feeCalc = getFees(ticketPrice, { buyerRate: 0.025, buyerMin: 1200 });

  const fees = {
    platformFee: feeCalc.buyerFee,
    tixswapFee: feeCalc.buyerFee,
  };

  const totals = {
    subtotal: ticketPrice,
    total: feeCalc.total,
    ticketPrice: ticketPrice,
  };

  // 3) Vendedor
  const { data: sellerProfile } = await supabase
    .from("profiles")
    .select("id, full_name, tier")
    .eq("id", ticket.seller_id)
    .single();

  // 4) Ratings del vendedor
  const { data: ratings } = await supabase
    .from("ratings")
    .select("stars, comment, created_at, rater_id")
    .eq("target_id", ticket.seller_id)
    .eq("role", "seller")
    .order("created_at", { ascending: false })
    .limit(5);

  let avg = 0;
  let count = 0;

  if (ratings?.length) {
    count = ratings.length;
    avg = ratings.reduce((acc, r) => acc + (r.stars || 0), 0) / count;
  }

  const preview = {
    ticket: {
      id: ticket.id,
      title: ticket.title,
      price: ticket.price,
      currency: ticket.currency,
      sector: ticket.sector,
      row_label: ticket.row_label,
      seat_label: ticket.seat_label,
      description: ticket.description,
    },
    event: {
      id: ev?.id,
      title: ev?.name,
      venue,
      city,
      date,
      time,
      image_url: ev?.image_url,
      starts_at: ev?.starts_at,
    },
    seller: {
      id: sellerProfile?.id || ticket.seller_id,
      name: sellerProfile?.full_name || "Vendedor",
      tier: sellerProfile?.tier || "basic",
      rating_avg: avg,
      rating_count: count,
      recent_ratings: ratings || [],
    },
    fees,
    totals,
    buyerRole: "basic",
  };

  return { preview };
}

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const ticketId = body.ticketId;

    if (!ticketId) {
      return NextResponse.json(
        { ok: false, error: "ticketId requerido" },
        { status: 400 }
      );
    }

    const { preview, error } = await buildPreview(ticketId);
    if (error) {
      return NextResponse.json({ ok: false, error }, { status: 404 });
    }

    return NextResponse.json({ ok: true, preview });
  } catch (err) {
    console.error("checkout/preview error:", err);
    return NextResponse.json(
      { ok: false, error: "Error interno" },
      { status: 500 }
    );
  }
}
