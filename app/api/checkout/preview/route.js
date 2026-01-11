import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { supabaseAdmin as getAdmin } from "@/lib/supabaseAdmin";

function pickFirst(...vals) {
  for (const v of vals) if (v !== undefined && v !== null && String(v).trim() !== "") return v;
  return null;
}

async function getSellerRating(admin, sellerId) {
  if (!sellerId) return { rating_avg: null, rating_count: 0 };

  const { data, error } = await admin
    .from("ratings")
    .select("stars")
    .eq("target_id", sellerId)
    .eq("role", "seller");

  if (error || !data) return { rating_avg: null, rating_count: 0 };

  const rating_count = data.length;
  const rating_avg =
    rating_count > 0
      ? data.reduce((acc, r) => acc + (Number(r.stars) || 0), 0) / rating_count
      : null;

  return { rating_avg, rating_count };
}

export async function GET(req) {
  try {
    const url = new URL(req.url);
    const ticketId = url.searchParams.get("ticketId");

    if (!ticketId) {
      return NextResponse.json({ error: "ticketId requerido" }, { status: 400 });
    }

    const supabase = createRouteHandlerClient({ cookies });
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const admin = getAdmin();

    const { data: ticket, error: tErr } = await admin
      .from("tickets")
      .select("*")
      .eq("id", ticketId)
      .single();

    if (tErr || !ticket) {
      return NextResponse.json({ error: "Ticket no encontrado" }, { status: 404 });
    }

    const { data: event, error: eErr } = await admin
      .from("events")
      .select("*")
      .eq("id", ticket.event_id)
      .single();

    if (eErr || !event) {
      return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });
    }

    let seller = null;
    if (ticket.seller_id) {
      const { data: sellerRow } = await admin
        .from("profiles")
        .select("id,full_name,email")
        .eq("id", ticket.seller_id)
        .maybeSingle();

      const rating = await getSellerRating(admin, ticket.seller_id);

      seller = {
        id: ticket.seller_id,
        username: pickFirst(sellerRow?.full_name, ticket.seller_name, sellerRow?.email, ticket.seller_email),
        rating_avg: rating.rating_avg,
        rating_count: rating.rating_count,
        reputation: rating.rating_avg
      };
    }

    const base = Number(ticket.price || 0);
    const service_fee = Math.round(base * 0.05);
    const total_clp = base + service_fee;

    const ticketOut = {
      ...ticket,
      section: ticket.sector ?? null,
      row: ticket.row_label ?? null,
      seat: ticket.seat_label ?? null,
      notes: ticket.description ?? null
    };

    const eventOut = {
      ...event,
      name: event.title ?? event.name ?? null,
      date: event.starts_at ?? event.date ?? null
    };

    return NextResponse.json(
      {
        ticket: ticketOut,
        event: eventOut,
        seller,
        amount_clp: base,
        service_fee,
        total_clp
      },
      { status: 200 }
    );
  } catch (e) {
    console.error("[api/checkout/preview] exception:", e);
    return NextResponse.json({ error: "Error al obtener resumen" }, { status: 500 });
  }
}

