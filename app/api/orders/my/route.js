import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

function avgStars(rows) {
  if (!rows || rows.length === 0) return { avg: 0, count: 0 };
  const nums = rows.map((r) => Number(r?.stars)).filter((n) => Number.isFinite(n));
  if (nums.length === 0) return { avg: 0, count: 0 };
  const sum = nums.reduce((a, b) => a + b, 0);
  return { avg: sum / nums.length, count: nums.length };
}

function normalizeEvent(e) {
  if (!e) return null;
  return {
    id: e.id,
    title: e.title ?? e.name ?? e.event_name ?? "Evento",
    name: e.name ?? e.title ?? e.event_name ?? "Evento",
    venue: e.venue ?? e.location ?? "",
    city: e.city ?? "",
    starts_at: e.starts_at ?? e.date ?? null,
    date: e.date ?? e.starts_at ?? null,
    image_url: e.image_url ?? e.image ?? null,
  };
}

function normalizeTicket(t, event) {
  if (!t) return null;
  const sector = t.sector ?? t.section ?? t.zone ?? "";
  const row = t.row_label ?? t.row ?? t.fila ?? "";
  const seat = t.seat_label ?? t.seat ?? t.asiento ?? "";
  return {
    id: t.id,
    price: t.price ?? 0,
    status: t.status ?? null,
    title: t.title ?? null,
    description: t.description ?? t.notes ?? null,
    sector,
    row,
    seat,
    section: t.section ?? sector,
    row_label: t.row_label ?? row,
    seat_label: t.seat_label ?? seat,
    event: event ? normalizeEvent(event) : null,
  };
}

function normalizeSeller(p, rep) {
  if (!p) return null;
  return {
    id: p.id,
    full_name: p.full_name ?? p.username ?? p.name ?? null,
    username: p.username ?? p.full_name ?? p.name ?? null,
    email: p.email ?? null,
    rating_avg: rep?.avg ?? 0,
    rating_count: rep?.count ?? 0,
    reputation: rep?.avg ?? 0,
  };
}

export async function GET() {
  const supabase = createRouteHandlerClient({ cookies });

  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();

  if (authErr || !user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const { data: orders, error: ordersErr } = await supabase
      .from("orders")
      .select("*")
      .eq("buyer_id", user.id)
      .order("created_at", { ascending: false });

    if (ordersErr) {
      return NextResponse.json({ orders: [], warning: ordersErr.message }, { status: 200 });
    }

    const ticketIds = Array.from(
      new Set((orders || []).map((o) => o.ticket_id).filter(Boolean))
    );

    const { data: tickets, error: ticketsErr } = ticketIds.length
      ? await supabase.from("tickets").select("*").in("id", ticketIds)
      : { data: [], error: null };

    const ticketById = {};
    (tickets || []).forEach((t) => (ticketById[t.id] = t));

    const eventIds = Array.from(
      new Set(
        (orders || [])
          .map((o) => o.event_id)
          .concat((tickets || []).map((t) => t.event_id))
          .filter(Boolean)
      )
    );

    const { data: events } = eventIds.length
      ? await supabase.from("events").select("*").in("id", eventIds)
      : { data: [] };

    const eventById = {};
    (events || []).forEach((e) => (eventById[e.id] = e));

    const sellerIds = Array.from(
      new Set(
        (orders || [])
          .map((o) => o.seller_id)
          .concat((tickets || []).map((t) => t.seller_id))
          .filter(Boolean)
      )
    );

    const { data: sellers } = sellerIds.length
      ? await supabase.from("profiles").select("*").in("id", sellerIds)
      : { data: [] };

    const sellerById = {};
    (sellers || []).forEach((p) => (sellerById[p.id] = p));

    const { data: ratings } = sellerIds.length
      ? await supabase.from("ratings").select("target_id,stars,role").in("target_id", sellerIds)
      : { data: [] };

    const repBySeller = {};
    sellerIds.forEach((sid) => {
      const rows = (ratings || []).filter((r) => r.target_id === sid);
      const sellerOnly = rows.filter((r) => r.role === "seller");
      repBySeller[sid] = avgStars(sellerOnly.length ? sellerOnly : rows);
    });

    const buyerRatings = await supabase
      .from("ratings")
      .select("stars,role,target_id")
      .eq("target_id", user.id);

    const buyerRows = buyerRatings.data || [];
    const buyerOnly = buyerRows.filter((r) => r.role === "buyer");
    const buyerRep = avgStars(buyerOnly.length ? buyerOnly : buyerRows);

    const enriched = (orders || []).map((o) => {
      const t = o.ticket_id ? ticketById[o.ticket_id] : null;
      const event = o.event_id ? eventById[o.event_id] : t?.event_id ? eventById[t.event_id] : null;
      const sellerId = o.seller_id ?? t?.seller_id ?? null;
      const seller = sellerId ? normalizeSeller(sellerById[sellerId], repBySeller[sellerId]) : null;

      return {
        id: o.id,
        status: o.status ?? "pending",
        created_at: o.created_at,
        paid_at: o.paid_at ?? null,
        payment_state: o.payment_state ?? null,
        payment_provider: o.payment_provider ?? o.payment_method ?? null,
        total_clp: o.total_clp ?? o.total_paid_clp ?? o.total_amount ?? 0,
        fee_clp: o.fee_clp ?? o.fees_clp ?? 0,
        ticket: normalizeTicket(t, event),
        seller,
      };
    });

    const { data: buyerProfile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    return NextResponse.json(
      {
        buyer: {
          id: user.id,
          email: user.email ?? buyerProfile?.email ?? null,
          full_name: buyerProfile?.full_name ?? buyerProfile?.username ?? null,
        },
        buyer_reputation: buyerRep,
        orders: enriched,
      },
      { status: 200 }
    );
  } catch (e) {
    return NextResponse.json({ orders: [], warning: e?.message ?? "Error" }, { status: 200 });
  }
}

