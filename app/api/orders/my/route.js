// app/api/orders/my/route.js
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function toNum(v) {
  const n = typeof v === "number" ? v : Number(String(v ?? "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

export async function GET() {
  try {
    const supabase = createRouteHandlerClient({ cookies });

    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr) return NextResponse.json({ error: userErr.message }, { status: 401 });
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // 1) Traer órdenes del usuario (buyer_id o user_id)
    const { data: orders, error: ordersErr } = await supabase
      .from("orders")
      .select("id, created_at, status, amount_clp, total_clp, total_amount, currency, ticket_id, event_id")
      .or(`buyer_id.eq.${user.id},user_id.eq.${user.id}`)
      .order("created_at", { ascending: false });

    if (ordersErr) return NextResponse.json({ error: ordersErr.message }, { status: 500 });

    const safeOrders = Array.isArray(orders) ? orders : [];

    // 2) Traer tickets asociados (en batch)
    const ticketIds = [...new Set(safeOrders.map((o) => o.ticket_id).filter(Boolean))];
    let ticketsById = {};

    if (ticketIds.length) {
      const { data: tickets, error: ticketsErr } = await supabase
        .from("tickets")
        .select(
          [
            "id",
            "event_id",
            "sector",
            "row_label",
            "seat_label",
            "section_label",
            "price",
            "original_price",
            "sale_type",
            "status",
            "currency",
          ].join(",")
        )
        .in("id", ticketIds);

      if (ticketsErr) return NextResponse.json({ error: ticketsErr.message }, { status: 500 });

      ticketsById = (tickets || []).reduce((acc, t) => {
        acc[t.id] = t;
        return acc;
      }, {});
    }

    // 3) Traer eventos asociados (order.event_id o ticket.event_id)
    const eventIds = [
      ...new Set(
        safeOrders
          .map((o) => o.event_id || ticketsById[o.ticket_id]?.event_id)
          .filter(Boolean)
      ),
    ];

    let eventsById = {};
    if (eventIds.length) {
      const { data: events, error: eventsErr } = await supabase
        .from("events")
        .select("id, title, category, venue, city, starts_at, image_url, created_at")
        .in("id", eventIds);

      if (eventsErr) return NextResponse.json({ error: eventsErr.message }, { status: 500 });

      eventsById = (events || []).reduce((acc, e) => {
        acc[e.id] = e;
        return acc;
      }, {});
    }

    // 4) Armar payload para el front (PurchasesPage)
    const enriched = safeOrders.map((o) => {
      const ticket = o.ticket_id ? ticketsById[o.ticket_id] || null : null;
      const eventId = o.event_id || ticket?.event_id || null;
      const event = eventId ? eventsById[eventId] || null : null;

      return {
        id: o.id,
        created_at: o.created_at,
        status: o.status ?? "pending",
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



