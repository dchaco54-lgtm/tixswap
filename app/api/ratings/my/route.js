import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

async function getUserFromRequest(req) {
  const auth = req.headers.get("authorization") || "";
  if (auth.startsWith("Bearer ")) {
    const token = auth.replace("Bearer ", "").trim();
    try {
      const admin = supabaseAdmin();
      const { data, error } = await admin.auth.getUser(token);
      if (!error && data?.user) return data.user;
    } catch {
      // fallback a cookies
    }
  }

  const cookieStore = cookies();
  const supabase = createClient(cookieStore);
  const { data } = await supabase.auth.getUser();
  return data?.user || null;
}

function calcAverage(list) {
  if (!list.length) return 0;
  const sum = list.reduce((acc, r) => acc + (Number(r.stars) || 0), 0);
  return Number((sum / list.length).toFixed(1));
}

export async function GET(req) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    let admin;
    try {
      admin = supabaseAdmin();
    } catch {
      return NextResponse.json(
        { error: "Missing Supabase env vars" },
        { status: 500 }
      );
    }

    const { data: ratings, error: rErr } = await admin
      .from("ratings")
      .select("id, order_id, rater_id, role, stars, comment, created_at")
      .eq("target_id", user.id)
      .order("created_at", { ascending: false });

    if (rErr) {
      return NextResponse.json(
        { error: "No se pudieron cargar calificaciones" },
        { status: 500 }
      );
    }

    const orderIds = Array.from(
      new Set((ratings || []).map((r) => r.order_id).filter(Boolean))
    );

    let orders = [];
    if (orderIds.length) {
      const { data: o } = await admin
        .from("orders")
        .select("id, ticket_id, event_id, status, created_at")
        .in("id", orderIds);
      orders = o || [];
    }

    const ordersById = {};
    for (const o of orders) ordersById[o.id] = o;

    const ticketIds = Array.from(
      new Set(orders.map((o) => o.ticket_id).filter(Boolean))
    );

    let tickets = [];
    if (ticketIds.length) {
      const { data: t } = await admin
        .from("tickets")
        .select("id, event_id, status, section_label, row_label, seat_label, sector")
        .in("id", ticketIds);
      tickets = t || [];
    }

    const ticketsById = {};
    for (const t of tickets) ticketsById[t.id] = t;

    const eventIds = Array.from(
      new Set(
        [
          ...tickets.map((t) => t.event_id),
          ...orders.map((o) => o.event_id),
        ].filter(Boolean)
      )
    );

    let events = [];
    if (eventIds.length) {
      const { data: e } = await admin
        .from("events")
        .select("id, title, starts_at, venue, city, image_url")
        .in("id", eventIds);
      events = e || [];
    }

    const eventsById = {};
    for (const e of events) eventsById[e.id] = e;

    const normalized = (ratings || []).map((r) => {
      const order = ordersById[r.order_id] || null;
      const ticket = order?.ticket_id ? ticketsById[order.ticket_id] || null : null;
      const eventId = ticket?.event_id || order?.event_id || null;
      const event = eventId ? eventsById[eventId] || null : null;

      return {
        ...r,
        order,
        ticket,
        event,
      };
    });

    const asSeller = normalized.filter((r) => r.role === "buyer");
    const asBuyer = normalized.filter((r) => r.role === "seller");

    return NextResponse.json({
      as_seller: {
        average: calcAverage(asSeller),
        count: asSeller.length,
        ratings: asSeller,
      },
      as_buyer: {
        average: calcAverage(asBuyer),
        count: asBuyer.length,
        ratings: asBuyer,
      },
    });
  } catch (err) {
    console.error("GET /api/ratings/my error", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
