import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function num(...vals) {
  for (const v of vals) {
    const n = Number(v);
    if (!Number.isNaN(n) && Number.isFinite(n)) return n;
  }
  return 0;
}

function buildRatingMap(rows) {
  const agg = new Map();
  for (const r of rows || []) {
    const id = r.target_id;
    const stars = Number(r.stars) || 0;
    const cur = agg.get(id) || { sum: 0, count: 0 };
    cur.sum += stars;
    cur.count += 1;
    agg.set(id, cur);
  }
  const out = new Map();
  for (const [id, v] of agg.entries()) {
    out.set(id, { rating_count: v.count, rating_avg: v.count ? v.sum / v.count : null });
  }
  return out;
}

export async function GET(request) {
  try {
    const authHeader = request.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.replace("Bearer ", "") : null;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser(token);

    if (userErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: orders, error } = await supabase
      .from("orders")
      .select(
        `
        id,status,created_at,updated_at,
        buyer_id,seller_id,ticket_id,event_id,
        total_clp,total_amount,amount_clp,fees_clp,fee_clp,payment_provider,payment_state,
        ticket:tickets (
          id,price,sector,row_label,seat_label,title,description,seller_id,seller_name,event_id,
          event:events ( id,title,venue,city,starts_at,image_url )
        )
      `
      )
      .eq("buyer_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ orders: [], warning: error.message }, { status: 200 });
    }

    const sellerIds = Array.from(new Set((orders || []).map((o) => o?.ticket?.seller_id || o?.seller_id).filter(Boolean)));

    let ratingMap = new Map();
    if (sellerIds.length) {
      const { data: ratingRows } = await supabase
        .from("ratings")
        .select("target_id,stars")
        .eq("role", "seller")
        .in("target_id", sellerIds);

      ratingMap = buildRatingMap(ratingRows || []);
    }

    const normalized = (orders || []).map((o) => {
      const t = o.ticket || null;
      const ev = t?.event || null;

      const sellerId = t?.seller_id || o.seller_id || null;
      const rating = ratingMap.get(sellerId) || { rating_avg: null, rating_count: 0 };

      const event = ev
        ? { ...ev, name: ev.title ?? ev.name ?? null, date: ev.starts_at ?? ev.date ?? null }
        : null;

      const ticket = t
        ? {
            ...t,
            section: t.sector ?? null,
            row: t.row_label ?? null,
            seat: t.seat_label ?? null,
            notes: t.description ?? null,
            event,
            seller: {
              id: sellerId,
              username: t.seller_name || null,
              reputation: rating.rating_avg,
              rating_avg: rating.rating_avg,
              rating_count: rating.rating_count
            }
          }
        : null;

      const total_amount = num(o.total_clp, o.total_amount);
      const service_fee = num(o.fees_clp, o.fee_clp);
      const amount_clp = num(o.amount_clp, total_amount - service_fee);

      return {
        id: o.id,
        status: o.status,
        created_at: o.created_at,
        updated_at: o.updated_at,
        ticket_id: o.ticket_id,
        provider: o.payment_provider || null,
        total_amount,
        service_fee,
        amount_clp,
        ticket
      };
    });

    return NextResponse.json({ orders: normalized }, { status: 200 });
  } catch (e) {
    console.error("[api/orders/my] exception:", e);
    return NextResponse.json({ orders: [], warning: "Unexpected error" }, { status: 200 });
  }
}

