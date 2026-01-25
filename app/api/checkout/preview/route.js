// app/api/checkout/preview/route.js
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { calculateFees } from "@/lib/fees";

function normalizeEventStartsAt(evt) {
  return evt?.starts_at || evt?.startsAt || evt?.date || evt?.datetime || null;
}

function normalizeEventImageUrl(evt) {
  return (
    evt?.image_url ||
    evt?.imageUrl ||
    evt?.cover_url ||
    evt?.banner_url ||
    evt?.poster_url ||
    null
  );
}

function pickTicketPrice(ticket) {
  // Canon: price (y si existiera alguna columna vieja, fallback)
  const p =
    ticket?.price ??
    ticket?.price_clp ??
    ticket?.amount_clp ??
    ticket?.amount ??
    0;

  return Math.max(0, Math.round(Number(p) || 0));
}

function normalizeTicket(ticket) {
  return {
    id: ticket?.id,
    status: String(ticket?.status || "").toLowerCase() || null,
    event_id: ticket?.event_id || null,
    seller_id: ticket?.seller_id || ticket?.owner_id || ticket?.user_id || null,

    // Para UI
    sector: ticket?.sector ?? ticket?.section ?? null,
    row_label: ticket?.row_label ?? ticket?.row ?? null,
    seat_label: ticket?.seat_label ?? ticket?.seat ?? null,
    notes: ticket?.notes ?? null,

    // Precio
    price: ticket?.price ?? null,
  };
}

function normalizeEvent(evt) {
  if (!evt) return null;
  return {
    id: evt.id,
    title: evt.title || evt.name || evt.event_name || null,
    starts_at: normalizeEventStartsAt(evt),
    venue: evt.venue || null,
    city: evt.city || null,
    image_url: normalizeEventImageUrl(evt),
  };
}

function pickDisplayName(profile) {
  // No usamos email. Solo nombre “humano”.
  const name =
    profile?.display_name ||
    profile?.full_name ||
    profile?.name ||
    profile?.username ||
    profile?.nickname ||
    null;

  const clean = String(name ?? "").trim();
  return clean ? clean : "Usuario";
}

function normalizeSeller(profile) {
  if (!profile) return { id: null, display_name: "Usuario", avatar_url: null };

  return {
    id: profile.id || null,
    display_name: pickDisplayName(profile),
    avatar_url: profile.avatar_url || profile.avatar || null,
  };
}

async function getProfileSafe(admin, userId) {
  // Ultra seguro: no asume columnas -> trae * y luego NO exponemos campos sensibles
  const { data, error } = await admin
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (error) return null;
  return data || null;
}

export async function POST(req) {
  try {
    const admin = supabaseAdmin();
    const body = await req.json().catch(() => ({}));
    const ticketId = body?.ticketId;

    if (!ticketId) {
      return NextResponse.json(
        { error: "ticketId requerido" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    // 1) Ticket
    const { data: ticket, error: tErr } = await admin
      .from("tickets")
      .select("*")
      .eq("id", ticketId)
      .maybeSingle();

    if (tErr || !ticket) {
      return NextResponse.json(
        { error: "Entrada no encontrada" },
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    }

    // Validación de estado: SOLO comprable si active/available
    const st = String(ticket.status || "").toLowerCase();
    if (!["active", "available"].includes(st)) {
      return NextResponse.json(
        { error: "Entrada no disponible" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const ticketNorm = normalizeTicket(ticket);
    const ticketPrice = pickTicketPrice(ticket);

    // 2) Evento
    let event = null;
    if (ticket.event_id) {
      const { data: evt, error: eErr } = await admin
        .from("events")
        .select("*")
        .eq("id", ticket.event_id)
        .maybeSingle();

      if (!eErr && evt) event = normalizeEvent(evt);
    }

    // 3) Vendedor (perfil) — SIN EMAIL
    const sellerId = ticketNorm.seller_id;
    const sellerProfile = sellerId ? await getProfileSafe(admin, sellerId) : null;
    const seller = normalizeSeller(sellerProfile);

    // 4) Fees
    const fees = calculateFees(ticketPrice);

    // 5) Ratings (si existe tabla)
    let sellerStats = { avgRating: null, totalRatings: 0 };
    let sellerRatings = [];

    try {
      if (sellerId) {
        const { data: ratings, error: rErr } = await admin
          .from("seller_ratings")
          .select("id,rating,comment,created_at") // NO buyer_id, NO emails
          .eq("seller_id", sellerId)
          .order("created_at", { ascending: false })
          .limit(20);

        if (!rErr && ratings?.length) {
          const avg =
            ratings.reduce((a, x) => a + (Number(x.rating) || 0), 0) /
            ratings.length;

          sellerStats = {
            avgRating: Number(avg.toFixed(1)),
            totalRatings: ratings.length,
          };
          sellerRatings = ratings;
        }
      }
    } catch {
      // si no existe la tabla, no rompe el checkout
    }

    return NextResponse.json(
      {
        ticket: ticketNorm,
        event,
        seller,        // { id, display_name, avatar_url }
        fees,
        sellerStats,   // reputación
        sellerRatings, // comentarios
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error("[checkout preview] error", err);
    return NextResponse.json(
      { error: err?.message || "Error" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}

