// app/api/orders/my/route.js
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function toNum(v) {
  const n = typeof v === "number" ? v : Number(String(v ?? "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

export async function GET() {
  try {
    // 1) Usuario logueado (cookies)
    const supabase = createClient(cookies());
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr) return NextResponse.json({ error: userErr.message }, { status: 401 });
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const admin = supabaseAdmin();

    // 2) Órdenes del usuario (bypass RLS, pero filtrado por user.id)
    const { data: orders, error: ordersErr } = await admin
      .from("orders")
      .select("id, created_at, status, payment_state, amount_clp, total_clp, total_amount, currency, ticket_id, event_id, buyer_id, user_id")
      .or(`buyer_id.eq.${user.id},user_id.eq.${user.id}`)
      .order("created_at", { ascending: false });

    if (ordersErr) return NextResponse.json({ error: ordersErr.message }, { status: 500 });

    const safeOrders = Array.isArray(orders) ? orders : [];

    // Safety extra (por si acaso)
    const mine = safeOrders.filter((o) => o?.buyer_id === user.id || o?.user_id === user.id);

    // 3) Tickets batch
    const ticketIds = [...new Set(mine.map((o) => o.ticket_id).filter(Boolean))];
    let ticketsById = {};
    if (ticketIds.length) {
      const { data: tickets, error: tErr } = await admin
        .from("tickets")
        .select("id, event_id, sector, row_label, seat_label, section_label, price, original_price, sale_type, status, currency")
        .in("id", ticketIds);

      if (tErr) return NextResponse.json({ error: tErr.message }, { status: 500 });

      ticketsById = (tickets || []).reduce((acc, t) => {
        acc[t.id] = t;
        return acc;
      }, {});
    }

    // 4) Eventos batch
    const eventIds = [
      ...new Set(
        mine
          .map((o) => o.event_id || ticketsById[o.ticket_id]?.event_id)
          .filter(Boolean)
      ),
    ];

    let eventsById = {};
    if (eventIds.length) {
      const { data: events, error: eErr } = await admin
        .from("events")
        .select("id, title, venue, city, starts_at, image_url")
        .in("id", eventIds);

      if (eErr) return NextResponse.json({ error: eErr.message }, { status: 500 });

      eventsById = (events || []).reduce((acc, e) => {
        acc[e.id] = e;
        return acc;
      }, {});
    }

    // 5) Payload final
    const enriched = mine.map((o) => {
      const ticket = o.ticket_id ? ticketsById[o.ticket_id] || null : null;
      const eventId = o.event_id || ticket?.event_id || null;
      const event = eventId ? eventsById[eventId] || null : null;

      return {
        id: o.id,
        created_at: o.created_at,
        status: o.status ?? "pending",
        payment_state: o.payment_state ?? null,
        amount_clp: toNum(o.amount_clp),
        total_clp: toNum(o.total_clp ?? o.total_amount),
        currency: o.currency ?? "CLP",
        ticket_id: o.ticket_id ?? null,
        event_id: eventId,
        ticket,
        event,
      };
    });

    return NextResponse.json({ orders: enriched }, { status: 200 });
  } catch (e) {
    return NextResponse.json({ error: e?.message || "Unknown error" }, { status: 500 });
  }
}



