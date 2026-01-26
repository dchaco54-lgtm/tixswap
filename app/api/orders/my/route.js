import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Dedupe: 1 orden por ticket_id, priorizando paid/AUTHORIZED > pending > resto, y si empata la más nueva
function rankOrder(o) {
  const status = String(o?.status || "").toLowerCase();
  const pstate = String(o?.payment_state || "").toUpperCase();

  if (status === "paid" || pstate === "AUTHORIZED") return 300;
  if (status === "pending" || pstate === "SESSION_CREATED" || pstate === "session_created") return 200;
  if (status === "cancelled" || status === "failed") return 0;
  return 100;
}

function dedupeByTicketId(orders) {
  const best = new Map();

  for (const o of orders) {
    const key = o.ticket_id || o.id;
    const prev = best.get(key);

    if (!prev) {
      best.set(key, o);
      continue;
    }

    const a = rankOrder(o);
    const b = rankOrder(prev);

    if (a > b) best.set(key, o);
    else if (a === b) {
      const ta = Date.parse(o.created_at || 0) || 0;
      const tb = Date.parse(prev.created_at || 0) || 0;
      if (ta > tb) best.set(key, o);
    }
  }

  return Array.from(best.values()).sort(
    (x, y) => (Date.parse(y.created_at || 0) || 0) - (Date.parse(x.created_at || 0) || 0)
  );
}

function getBearer(req) {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m?.[1] || null;
}

export async function GET(req) {
  try {
    const token = getBearer(req);
    if (!token) {
      return NextResponse.json(
        { orders: [], error: "Missing Authorization Bearer token" },
        { status: 200 }
      );
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !anon) {
      return NextResponse.json(
        { orders: [], error: "Missing Supabase env vars" },
        { status: 500 }
      );
    }

    // IMPORTANT: este client usa el JWT del usuario para que RLS funcione
    const supabase = createSupabaseClient(url, anon, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });

    // valida token => user
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    const user = userData?.user;

    if (userErr || !user) {
      return NextResponse.json({ orders: [], error: "Invalid session" }, { status: 200 });
    }

    // NO hagas orders -> events directo (te da el error de relationship).
    // Haz orders -> ticket -> event (como tu JSON de Network).
    const { data: ordersRaw, error } = await supabase
      .from("orders")
      .select(`
        id,
        ticket_id,
        listing_id,
        buyer_id,
        user_id,
        seller_id,
        status,
        payment_state,
        created_at,
        updated_at,
        paid_at,
        buy_order,
        session_id,
        webpay_token,
        total_clp,
        amount_clp,
        fee_clp,
        currency,
        ticket:ticket_id (
          id,
          created_at,
          event_id,
          seller_id,
          seller_email,
          seller_name,
          sector,
          row_label,
          seat_label,
          section_label,
          price,
          original_price,
          sale_type,
          status,
          seller_rut,
          platform_fee,
          currency,
          event:event_id (
            id,
            title,
            category,
            venue,
            city,
            starts_at,
            image_url,
            created_at
          )
        )
      `)
      .or(`buyer_id.eq.${user.id},user_id.eq.${user.id}`)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ orders: [], error: error.message }, { status: 500 });
    }

    const orders = ordersRaw || [];
    const deduped = dedupeByTicketId(orders);

    // normaliza event al nivel del order (igual que tu Network)
    const normalized = deduped.map((o) => {
      const ticket = o.ticket || null;
      const event = ticket?.event || null;
      const cleanTicket = ticket ? { ...ticket } : null;
      if (cleanTicket && "event" in cleanTicket) delete cleanTicket.event;

      return { ...o, ticket: cleanTicket, event };
    });

    return NextResponse.json({ orders: normalized }, { status: 200 });
  } catch (e) {
    return NextResponse.json(
      { orders: [], error: e?.message || "Unexpected error" },
      { status: 500 }
    );
  }
}



