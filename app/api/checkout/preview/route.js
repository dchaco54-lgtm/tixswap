// app/api/checkout/preview/route.js
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { calculateFees } from "@/lib/fees";

function getAdminOrResponse() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return {
      error: NextResponse.json({ error: "Missing Supabase env vars" }, { status: 500 }),
    };
  }

  return {
    admin: createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    }),
  };
}

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
  const p = ticket?.price_clp ?? ticket?.price ?? ticket?.amount_clp ?? ticket?.amount ?? 0;
  return Math.max(0, Math.round(Number(p) || 0));
}

function normalizeTicket(ticket) {
  return {
    id: ticket?.id,
    status: ticket?.status || null,
    event_id: ticket?.event_id || null,
    seller_id: ticket?.seller_id || ticket?.owner_id || ticket?.user_id || null,

    seller_name: ticket?.seller_name ?? ticket?.sellerName ?? null,

    sector: ticket?.sector ?? ticket?.section ?? null,
    row_label: ticket?.row_label ?? ticket?.row ?? null,
    seat_label: ticket?.seat_label ?? ticket?.seat ?? null,
    notes: ticket?.notes ?? null,

    price: ticket?.price ?? null,
    price_clp: ticket?.price_clp ?? null,
    original_price: ticket?.original_price ?? null,
  };
}

function normalizeSeller(profile) {
  if (!profile) return null;

  const full = profile.full_name || profile.name || profile.email || null;

  return {
    id: profile.id,
    full_name: full,
    avatar_url: profile.avatar_url || null,
  };
}

function normalizeEvent(evt) {
  if (!evt) return null;

  return {
    id: evt.id,
    title: evt.title || evt.name || evt.event_name || null,
    name: evt.name || null,
    starts_at: normalizeEventStartsAt(evt),
    venue: evt.venue || null,
    city: evt.city || null,
    image_url: normalizeEventImageUrl(evt),
  };
}

async function getProfileSafe(admin, userId) {
  // OJO: information_schema no siempre está expuesto por PostgREST.
  // Si falla, fallback a lo mínimo.
  const { data: cols, error: cErr } = await admin
    .from("information_schema.columns")
    .select("column_name")
    .eq("table_schema", "public")
    .eq("table_name", "profiles");

  if (cErr) {
    const { data } = await admin.from("profiles").select("id").eq("id", userId).maybeSingle();
    return data ? { id: data.id } : null;
  }

  const set = new Set((cols || []).map((x) => x.column_name));
  const fields = ["id", "full_name", "name", "avatar_url"].filter((f) => set.has(f));
  const selectStr = fields.length ? fields.join(",") : "id";

  const { data: prof, error } = await admin
    .from("profiles")
    .select(selectStr)
    .eq("id", userId)
    .maybeSingle();

  if (error) return null;
  return prof || null;
}

async function handlePreview(admin, ticketId) {
  if (!ticketId) {
    return NextResponse.json({ error: "ticketId requerido" }, { status: 400 });
  }

  // 1) Ticket
  const { data: ticket, error: tErr } = await admin
    .from("tickets")
    .select("*")
    .eq("id", ticketId)
    .maybeSingle();

  if (tErr || !ticket) {
    return NextResponse.json({ error: "Entrada no encontrada" }, { status: 404 });
  }

  // Validación de estado (ajusta si tu negocio permite más estados)
  const st = String(ticket.status || "").toLowerCase();
  if (st && !["active", "available", "paused"].includes(st)) {
    return NextResponse.json({ error: "Entrada no disponible" }, { status: 400 });
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

  // 3) Vendedor (perfil)
  const sellerId = ticketNorm.seller_id;
  const sellerProfile = sellerId ? await getProfileSafe(admin, sellerId) : null;
  const sellerFromProfile = normalizeSeller(sellerProfile);

  const seller = {
    id: sellerId || sellerFromProfile?.id || null,
    full_name: sellerFromProfile?.full_name || ticketNorm.seller_name || null,
    avatar_url: sellerFromProfile?.avatar_url || null,
  };

  // 4) Fees (REGLA FIJA)
  const fees = calculateFees(ticketPrice);

  // 5) Ratings (si existe tabla)
  let sellerStats = { avgRating: null, totalRatings: 0 };
  let sellerRatings = [];

  try {
    if (sellerId) {
      const { data: ratings, error: rErr } = await admin
        .from("seller_ratings")
        .select("id,seller_id,buyer_id,rating,comment,created_at")
        .eq("seller_id", sellerId)
        .order("created_at", { ascending: false })
        .limit(20);

      if (!rErr && ratings?.length) {
        const avg =
          ratings.reduce((a, x) => a + (Number(x.rating) || 0), 0) / ratings.length;
        sellerStats = { avgRating: Number(avg.toFixed(1)), totalRatings: ratings.length };
        sellerRatings = ratings;
      }
    }
  } catch {
    // si no existe la tabla, no rompe el checkout
  }

  return NextResponse.json({
    ticket: ticketNorm,
    event,
    seller,
    fees,
    sellerStats,
    sellerRatings,
  });
}

export async function GET(req) {
  try {
    const { admin, error } = getAdminOrResponse();
    if (error) return error;
    const url = new URL(req.url);
    const ticketId = url.searchParams.get("ticketId");
    return await handlePreview(admin, ticketId);
  } catch (err) {
    console.error("[checkout preview][GET] error", err);
    return NextResponse.json({ error: err?.message || "Error" }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const { admin, error } = getAdminOrResponse();
    if (error) return error;
    const body = await req.json().catch(() => ({}));
    const ticketId = body?.ticketId;
    return await handlePreview(admin, ticketId);
  } catch (err) {
    console.error("[checkout preview][POST] error", err);
    return NextResponse.json({ error: err?.message || "Error" }, { status: 500 });
  }
}

