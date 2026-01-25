export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createClient } from "@/lib/supabase/server";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  Pragma: "no-cache",
};

function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function pickPrice(t) {
  // ✅ preferimos `price` (tu canon actual)
  // pero dejamos fallbacks por compatibilidad (por si en algún ambiente existe otra col)
  const candidates = [
    t?.price,
    t?.price_clp,
    t?.amount_clp,
    t?.amount,
    t?.total_clp,
    t?.total,
  ];

  for (const c of candidates) {
    const n = toNum(c);
    if (n !== null) return Math.max(0, Math.round(n));
  }
  return 0;
}

function pickStatus(t) {
  const s =
    t?.status ??
    t?.state ??
    t?.availability ??
    t?.ticket_status ??
    null;
  return s ? String(s).toLowerCase() : null;
}

function normalizeTicket(t, eventMap) {
  const eventId = t?.event_id ?? t?.eventId ?? null;

  // sector/row/seat: tu front usa listing.section/row/seat
  const section = t?.section ?? t?.sector ?? t?.sector_label ?? null;
  const row = t?.row ?? t?.row_label ?? null;
  const seat = t?.seat ?? t?.seat_label ?? null;

  return {
    id: t?.id,
    created_at: t?.created_at ?? t?.createdAt ?? null,

    seller_id: t?.seller_id ?? t?.owner_id ?? t?.user_id ?? null,
    event_id: eventId,

    status: pickStatus(t),
    price: pickPrice(t),

    // extras por si los ocupas en UI
    original_price: t?.original_price ?? null,
    sale_type: t?.sale_type ?? null,
    notes: t?.notes ?? null,

    section,
    row,
    seat,

    event: eventId ? (eventMap[eventId] || null) : null,
  };
}

async function getUserIdFromRequest(request, admin) {
  // 1) Bearer token (tu front lo manda)
  const authHeader = request.headers.get("authorization") || "";
  if (authHeader.toLowerCase().startsWith("bearer ")) {
    const token = authHeader.slice(7).trim();
    const { data: userRes, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userRes?.user) return null;
    return userRes.user.id;
  }

  // 2) Fallback cookies
  const supabase = createClient(cookies());
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  return user.id;
}

export async function GET(request) {
  try {
    const admin = supabaseAdmin();

    const userId = await getUserIdFromRequest(request, admin);
    if (!userId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401, headers: NO_STORE_HEADERS });
    }

    // ✅ Traemos tickets reales del seller (sin supuestos de columnas raras)
    const { data: rawTickets, error: tErr } = await admin
      .from("tickets")
      .select("*")
      .eq("seller_id", userId)
      .order("created_at", { ascending: false })
      .limit(100);

    if (tErr) {
      return NextResponse.json(
        { error: "Error al obtener publicaciones", details: tErr.message },
        { status: 500, headers: NO_STORE_HEADERS }
      );
    }

    const tickets = rawTickets || [];

    // ✅ Traemos eventos aparte (0 dolor con embeds)
    const eventIds = Array.from(new Set(tickets.map(t => t?.event_id).filter(Boolean)));
    let eventMap = {};

    if (eventIds.length) {
      const { data: events, error: eErr } = await admin
        .from("events")
        .select("id,title,starts_at,venue,city,image_url")
        .in("id", eventIds);

      if (!eErr && Array.isArray(events)) {
        eventMap = Object.fromEntries(events.map(e => [e.id, e]));
      }
    }

    const normTickets = tickets.map(t => normalizeTicket(t, eventMap));

    const active = normTickets.filter(t => ["active", "available"].includes(String(t.status || "").toLowerCase())).length;
    const paused = normTickets.filter(t => String(t.status || "").toLowerCase() === "paused").length;
    const sold = normTickets.filter(t => String(t.status || "").toLowerCase() === "sold").length;

    return NextResponse.json(
      { tickets: normTickets, summary: { total: normTickets.length, active, paused, sold } },
      { status: 200, headers: NO_STORE_HEADERS }
    );
  } catch (err) {
    console.error("Error en GET /api/tickets/my-publications:", err);
    return NextResponse.json(
      { error: "Error inesperado", details: err?.message || String(err) },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}
