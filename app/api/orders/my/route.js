// app/api/orders/my/route.js
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { detectTicketColumns } from "@/lib/db/ticketSchema";

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
      const ticketCols = await detectTicketColumns(admin);
      let ticketSelect = "id, event_id, sector, row_label, seat_label, section_label, price, original_price, sale_type, status, currency";
      if (ticketCols.has("ticket_upload_id")) ticketSelect += ", ticket_upload_id";
      if (ticketCols.has("ticket_uploads_id")) ticketSelect += ", ticket_uploads_id";
      if (ticketCols.has("is_nominated")) ticketSelect += ", is_nominated";
      if (ticketCols.has("is_nominada")) ticketSelect += ", is_nominada";

      const { data: tickets, error: tErr } = await admin
        .from("tickets")
        .select(ticketSelect)
        .in("id", ticketIds);

      if (tErr) return NextResponse.json({ error: tErr.message }, { status: 500 });

      const uploadsIds = Array.from(
        new Set(
          (tickets || [])
            .map((t) => t.ticket_upload_id || t.ticket_uploads_id)
            .filter(Boolean)
        )
      );
      let uploadMap = {};
      if (uploadsIds.length) {
        const { data: uploads } = await admin
          .from("ticket_uploads")
          .select("id, is_nominated, is_nominada")
          .in("id", uploadsIds);
        if (Array.isArray(uploads)) {
          uploadMap = Object.fromEntries(uploads.map((u) => [u.id, u]));
        }
      }

      ticketsById = (tickets || []).reduce((acc, t) => {
        const uploadId = t.ticket_upload_id || t.ticket_uploads_id;
        const upload = uploadId ? uploadMap[uploadId] : null;
        const nominated = Boolean(
          t.is_nominated ??
          t.is_nominada ??
          upload?.is_nominated ??
          upload?.is_nominada ??
          false
        );
        acc[t.id] = { ...t, is_nominated: nominated };
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

    // 5) Traer buyer_name y buyer_rut para cada orden (desde profiles)
    let buyerProfiles = {};
    const buyerIds = Array.from(new Set(mine.map((o) => o.buyer_id || o.user_id).filter(Boolean)));
    if (buyerIds.length) {
      try {
        const { data: profiles, error: buyerErr } = await admin
          .from("profiles")
          .select("id, full_name, rut")
          .in("id", buyerIds);
        if (buyerErr) {
          console.error("GET /api/orders/my buyer profile join error", buyerErr);
        }
        if (profiles) {
          buyerProfiles = Object.fromEntries(profiles.map(p => [p.id, p]));
        }
      } catch (e) {
        console.error("GET /api/orders/my buyer profile join exception", e);
      }
    }

    const enriched = mine.map((o) => {
      const ticket = o.ticket_id ? ticketsById[o.ticket_id] || null : null;
      const eventId = o.event_id || ticket?.event_id || null;
      const event = eventId ? eventsById[eventId] || null : null;
      const buyerId = o.buyer_id || o.user_id;
      const buyerProfile = buyerId ? buyerProfiles[buyerId] : null;
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
        buyer_name: buyerProfile?.full_name || null,
        buyer_rut: buyerProfile?.rut || null,
      };
    });

    return NextResponse.json({ orders: enriched }, { status: 200 });
  } catch (e) {
    return NextResponse.json({ error: e?.message || "Unknown error" }, { status: 500 });
  }
}


