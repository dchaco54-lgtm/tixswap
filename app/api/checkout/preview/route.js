import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { buildTicketSelect, detectTicketColumns, normalizeTicket } from "@/lib/db/ticketSchema";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
  Pragma: "no-cache",
  Expires: "0",
};

function titleCase(str) {
  return String(str || "")
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function nameFromEmail(email) {
  const left = String(email || "").split("@")[0] || "";
  const cleaned = left.replace(/[._-]+/g, " ").replace(/\d+/g, " ").trim();
  const tc = titleCase(cleaned);
  return tc || null;
}

async function safeGetProfile(admin, userId) {
  // Intentos progresivos para evitar “column does not exist”
  const tries = [
    "id,full_name,name,display_name,username,avatar_url",
    "id,full_name,name,avatar_url",
    "id,full_name,avatar_url",
    "id,name,avatar_url",
    "id,avatar_url",
    "id",
  ];

  for (const select of tries) {
    const { data, error } = await admin
      .from("profiles")
      .select(select)
      .eq("id", userId)
      .maybeSingle();

    if (!error) return data || null;
  }
  return null;
}

async function safeGetAuthUser(admin, userId) {
  try {
    const { data, error } = await admin.auth.admin.getUserById(userId);
    if (error) return null;
    return data?.user || null;
  } catch {
    return null;
  }
}

function pickBestDisplayName(profile, authUser) {
  const profileName =
    profile?.full_name ||
    profile?.display_name ||
    profile?.name ||
    profile?.username ||
    null;

  const meta = authUser?.user_metadata || {};
  const metaName = meta.full_name || meta.name || meta.display_name || null;

  const email = authUser?.email || profile?.email || null;
  const derived = email ? nameFromEmail(email) : null;

  return titleCase(profileName || metaName || derived || "Usuario");
}

export async function GET(req) {
  try {
    const url = new URL(req.url);
    const ticketId = url.searchParams.get("ticketId");

    if (!ticketId) {
      return NextResponse.json(
        { error: "ticketId es requerido" },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    const admin = supabaseAdmin();

    // Ticket + event (select safe según columnas)
    const cols = await detectTicketColumns(admin);
    const select = buildTicketSelect(cols);

    const { data: rawTicket, error: ticketErr } = await admin
      .from("tickets")
      .select(select)
      .eq("id", ticketId)
      .maybeSingle();

    if (ticketErr || !rawTicket) {
      return NextResponse.json(
        { error: ticketErr?.message || "Ticket no encontrado" },
        { status: 404, headers: NO_STORE_HEADERS }
      );
    }

    const ticket = normalizeTicket(rawTicket);

    // Seller profile (sin exponer email)
    const sellerId = ticket.seller_id;
    const [profile, authUser] = await Promise.all([
      safeGetProfile(admin, sellerId),
      safeGetAuthUser(admin, sellerId),
    ]);

    const displayName = pickBestDisplayName(profile, authUser);

    // Stats vendedor (ventas + rating)
    let soldCount = 0;
    let ratingAvg = 0;
    let ratingCount = 0;

    try {
      const { count } = await admin
        .from("tickets")
        .select("id", { count: "exact", head: true })
        .eq("seller_id", sellerId)
        .in("status", ["sold"]);

      soldCount = count || 0;
    } catch {
      soldCount = 0;
    }

    try {
      const { data: ratingRows } = await admin
        .from("ratings")
        .select("score")
        .eq("ratee_id", sellerId);

      const scores = (ratingRows || []).map((r) => Number(r.score)).filter((n) => Number.isFinite(n));
      ratingCount = scores.length;
      ratingAvg = ratingCount ? scores.reduce((a, b) => a + b, 0) / ratingCount : 0;
    } catch {
      ratingAvg = 0;
      ratingCount = 0;
    }

    // Últimas reviews (sin join para evitar columnas faltantes)
    let sellerRatings = [];
    try {
      const { data: ratings } = await admin
        .from("ratings")
        .select("id,score,comment,created_at,rater_id")
        .eq("ratee_id", sellerId)
        .order("created_at", { ascending: false })
        .limit(5);

      const enriched = await Promise.all(
        (ratings || []).map(async (r) => {
          const rProfile = await safeGetProfile(admin, r.rater_id);
          const rAuth = await safeGetAuthUser(admin, r.rater_id);
          const rName = pickBestDisplayName(rProfile, rAuth);
          return {
            id: r.id,
            score: r.score,
            comment: r.comment,
            created_at: r.created_at,
            rater: { id: r.rater_id, full_name: rName },
          };
        })
      );

      sellerRatings = enriched;
    } catch {
      sellerRatings = [];
    }

    return NextResponse.json(
      {
        ticket,
        seller: {
          id: sellerId,
          full_name: displayName, // 👈 esto es lo que va a mostrar el front
          avatar_url: profile?.avatar_url || null,
        },
        sellerStats: {
          soldCount,
          ratingAvg,
          ratingCount,
        },
        sellerRatings,
      },
      { headers: NO_STORE_HEADERS }
    );
  } catch (err) {
    return NextResponse.json(
      { error: err?.message || "Error inesperado" },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}

