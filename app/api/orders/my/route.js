import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Requiere en .env (server only):
 * - SUPABASE_URL
 * - SUPABASE_ANON_KEY  (o NEXT_PUBLIC_SUPABASE_ANON_KEY)
 * - SUPABASE_SERVICE_ROLE_KEY  (server only)
 *
 * OJO: SERVICE_ROLE_KEY jamás al cliente.
 */
const SUPABASE_URL =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;

const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function getBearerToken(req) {
  const h = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!h) return null;
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m?.[1] || null;
}

function scoreOrder(o) {
  const status = String(o?.status || "").toLowerCase();
  const paymentState = String(o?.payment_state || "").toUpperCase();

  // prioridad: paid/AUTHORIZED > pending > resto
  let s = 0;
  if (status === "paid" && paymentState === "AUTHORIZED") s = 100;
  else if (status === "paid") s = 90;
  else if (status === "pending") s = 60;
  else if (status === "created" || status === "initiated") s = 40;
  else s = 10;

  // desempate por fecha
  const t = new Date(o?.created_at || 0).getTime();
  return s * 1_000_000_000 + (Number.isFinite(t) ? t : 0);
}

function dedupeByTicketId(orders = []) {
  const best = new Map();

  for (const o of orders) {
    const key = o?.ticket_id || o?.ticket?.id || o?.id; // fallback
    if (!key) continue;

    const current = best.get(key);
    if (!current || scoreOrder(o) > scoreOrder(current)) {
      best.set(key, o);
    }
  }

  return Array.from(best.values());
}

export async function GET(req) {
  try {
    // 1) token
    const token = getBearerToken(req);
    if (!token) {
      return NextResponse.json(
        { error: "Missing bearer token" },
        { status: 401 }
      );
    }

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { error: "Missing Supabase env vars" },
        { status: 500 }
      );
    }

    // 2) validar usuario (con ANON + getUser(token))
    const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: userData, error: userErr } = await supabaseAuth.auth.getUser(
      token
    );

    if (userErr || !userData?.user?.id) {
      return NextResponse.json(
        { error: "Invalid session token" },
        { status: 401 }
      );
    }

    const userId = userData.user.id;

    // 3) query con SERVICE ROLE (para que no te mate el RLS en MVP)
    //    y hacemos join por ticket -> event (NO orders->events)
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: rows, error: qErr } = await supabaseAdmin
      .from("orders")
      .select(
        `
        id, listing_id, buyer_id, seller_id, ticket_id,
        status, payment_state, payment_provider,
        created_at, updated_at, paid_at,
        buy_order, session_id, webpay_token,
        amount_clp, fee_clp, total_clp, total_amount, currency,
        ticket:tickets (
          id, created_at, event_id, seller_id,
          seller_email, seller_name, seller_rut,
          sector, row_label, seat_label, section_label,
          price, original_price, sale_type, status, currency,
          platform_fee,
          event:events (
            id, title, category, venue, city, starts_at, image_url, created_at
          )
        )
      `
      )
      .eq("buyer_id", userId)
      .order("created_at", { ascending: false });

    if (qErr) {
      return NextResponse.json(
        { error: qErr.message || "Query failed" },
        { status: 500 }
      );
    }

    // 4) normalizar: event top-level + ticket top-level (como tu JSON)
    const normalized = (rows || []).map((o) => {
      const ticket = o.ticket || null;
      const event = ticket?.event || null;

      // limpia nested event dentro de ticket para no duplicar si quieres
      const cleanTicket = ticket
        ? { ...ticket, event: undefined }
        : null;

      return {
        ...o,
        ticket: cleanTicket,
        event,
      };
    });

    // 5) dedupe por ticket_id (paid/AUTHORIZED gana)
    const cleaned = dedupeByTicketId(normalized);

    return NextResponse.json({ orders: cleaned });
  } catch (e) {
    console.error("GET /api/orders/my error:", e);
    return NextResponse.json(
      { error: e?.message || "Unknown error" },
      { status: 500 }
    );
  }
}


