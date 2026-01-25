// app/api/checkout/preview/route.js
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: { persistSession: false },
  }
);

// ✅ Email enmascarado por seguridad
function maskEmail(email) {
  if (!email || typeof email !== "string" || !email.includes("@")) return null;
  const [local, domain] = email.split("@");
  if (!local || !domain) return null;

  if (local.length <= 2) return `${local[0]}*@${domain}`;
  const stars = "*".repeat(Math.min(6, local.length - 2));
  return `${local[0]}${stars}${local.slice(-1)}@${domain}`;
}

function normalizeEventStartsAt(value) {
  if (!value) return null;
  try {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d.toISOString();
  } catch {
    return null;
  }
}

// ✅ Vendedor seguro (siempre devuelve full_name usable)
function normalizeSeller(profile) {
  if (!profile) return null;

  const displayName =
    profile.full_name ||
    profile.name ||
    profile.display_name ||
    profile.username ||
    (profile.email ? String(profile.email).split("@")[0] : null) ||
    "Usuario";

  return {
    id: profile.id,
    full_name: displayName,
    email: maskEmail(profile.email) || null,
    avatar_url:
      profile.avatar_url || profile.profile_image_url || profile.photo_url || null,
    is_verified: Boolean(
      profile.is_verified ??
        profile.verified ??
        profile.is_verified_seller ??
        profile.seller_verified ??
        false
    ),
  };
}

function normalizeEvent(event) {
  if (!event) return null;
  return {
    id: event.id,
    name: event.name || event.title || null,
    venue: event.venue || null,
    city: event.city || null,
    starts_at: normalizeEventStartsAt(event.starts_at || event.date),
    image_url: event.image_url || null,
  };
}

function normalizeSellerStats(stats) {
  if (!stats) return null;
  return {
    total_sales: Number(stats.total_sales || 0),
    total_reviews: Number(stats.total_reviews || 0),
    avg_rating: Number(stats.avg_rating || 0),
  };
}

function calculateFees(ticketPrice) {
  // ✅ 2.5% con mínimo 1200
  const fee = Math.max(Math.round(ticketPrice * 0.025), 1200);
  return { fee, total: ticketPrice + fee };
}

// ✅ Prioriza price por sobre price_clp
function pickTicketPrice(ticket) {
  const p =
    ticket?.price ??
    ticket?.price_clp ??
    ticket?.amount_clp ??
    ticket?.amount ??
    0;

  return Math.max(0, Math.round(Number(p) || 0));
}

// ✅ PERFIL SEGURO SIN INFORMATION_SCHEMA (esto era lo que te estaba rompiendo)
async function getProfileSafe(userId) {
  if (!userId) return null;

  const { data, error } = await admin
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.error("Seller profile fetch error:", error);
    return null;
  }

  return data || null;
}

export async function POST(req) {
  try {
    const body = await req.json();
    const ticketId = body.ticketId;

    if (!ticketId) {
      return NextResponse.json({ error: "ticketId requerido" }, { status: 400 });
    }

    // 1) Ticket
    const { data: ticket, error: tErr } = await admin
      .from("tickets")
      .select(
        `
        id,
        event_id,
        user_id,
        status,
        price,
        price_clp,
        original_price,
        currency,
        pdf_url,
        event_image_url,
        notes
      `
      )
      .eq("id", ticketId)
      .maybeSingle();

    if (tErr) throw tErr;
    if (!ticket) return NextResponse.json({ error: "Ticket no encontrado" }, { status: 404 });

    if (ticket.status && ticket.status !== "active") {
      return NextResponse.json({ error: "Entrada no disponible" }, { status: 400 });
    }

    // 2) Evento
    const { data: event, error: eErr } = await admin
      .from("events")
      .select("id, title, name, starts_at, date, venue, city, image_url")
      .eq("id", ticket.event_id)
      .maybeSingle();

    if (eErr) throw eErr;

    // 3) Perfil vendedor
    const sellerProfile = await getProfileSafe(ticket.user_id);
    const seller =
      normalizeSeller(sellerProfile) || {
        id: ticket.user_id,
        full_name: "Usuario",
        email: null,
        avatar_url: null,
        is_verified: false,
      };

    // 4) Stats vendedor
    const { data: stats } = await admin
      .from("seller_stats")
      .select("total_sales,total_reviews,avg_rating")
      .eq("user_id", ticket.user_id)
      .maybeSingle();

    // 5) Reviews vendedor (últimas 5)
    const { data: ratings } = await admin
      .from("seller_ratings")
      .select("id,rating,comment,created_at,buyer_id")
      .eq("seller_id", ticket.user_id)
      .order("created_at", { ascending: false })
      .limit(5);

    const ticketNorm = {
      ...ticket,
      seller_id: ticket.user_id,
    };

    // ✅ cálculo basado en precio actual (price si existe)
    const ticketPrice = pickTicketPrice(ticketNorm);
    const { fee, total } = calculateFees(ticketPrice);

    return NextResponse.json({
      ticket: ticketNorm,
      event: normalizeEvent(event),
      seller,
      sellerStats: normalizeSellerStats(stats),
      sellerRatings: ratings || [],
      fee,
      total,
    });
  } catch (err) {
    console.error("checkout/preview error", err);
    return NextResponse.json({ error: err?.message || "Error interno" }, { status: 500 });
  }
}


