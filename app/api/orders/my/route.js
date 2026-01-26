// app/api/orders/my/route.js
// Devuelve las compras del usuario logueado (buyer), con ticket + evento embebidos.
// Importante: NO usamos relaciones (select event:events(*)) porque en muchos schemas no hay FK y Supabase tira:
// "Could not find a relationship between 'orders' and 'events' in the schema cache".

import { cookies } from "next/headers";
import { createServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function toIso(v) {
  try {
    return new Date(v).toISOString();
  } catch {
    return null;
  }
}

// Ranking pedido:
// 1) paid / AUTHORIZED
// 2) pending
// 3) resto
function rankOrder(o) {
  const status = String(o?.status ?? "").toLowerCase();
  const pstate = String(o?.payment_state ?? "").toUpperCase();

  if (status === "paid" || pstate === "AUTHORIZED") return 3;
  if (status === "pending") return 2;
  return 1;
}

// Decide si "a" es mejor que "b"
function isBetter(a, b) {
  if (!b) return true;

  const ra = rankOrder(a);
  const rb = rankOrder(b);

  if (ra !== rb) return ra > rb;

  // empate → más nuevo
  const da = new Date(a.created_at).getTime();
  const db = new Date(b.created_at).getTime();
  return da > db;
}

export async function GET() {
  try {
    const supabase = createServerClient(cookies());
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return Response.json({ error: "No autorizado" }, { status: 401 });
    }

    // 1) Traemos todas las órdenes del usuario (buyer)
    const { data: rows, error } = await supabase
      .from("orders")
      .select(
        [
          "id",
          "listing_id",
          "ticket_id",
          "buyer_id",
          "seller_id",
          "user_id",
          "status",
          "payment_state",
          "payment_provider",
          "payment_method",
          "created_at",
          "updated_at",
          "paid_at",
          "buy_order",
          "session_id",
          "webpay_token",
          "amount_clp",
          "fee_clp",
          "fees_clp",
          "total_clp",
          "total_paid_clp",
          "total_amount",
          "currency",
        ].join(",")
      )
      // fallback por compat: a veces queda buyer_id o user_id
      .or(`buyer_id.eq.${user.id},user_id.eq.${user.id}`)
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) {
      console.error("[api/orders/my] orders select error:", error);
      return Response.json({ error: error.message }, { status: 500 });
    }

    const orders = rows ?? [];

    // 2) DEDUPE por ticket_id: dejamos la mejor por ticket (paid/AUTH > pending > resto)
    const bestByTicket = new Map();

    for (const o of orders) {
      const key = o.ticket_id || o.id; // fallback si no hay ticket_id por algún bug
      const current = bestByTicket.get(key);

      if (isBetter(o, current)) {
        bestByTicket.set(key, o);
      }
    }

    // opcional: filtrar estados que nunca quieres mostrar
    const cleaned = Array.from(bestByTicket.values()).filter((o) => {
      const st = String(o.status ?? "").toLowerCase();
      return !["cancelled", "failed"].includes(st);
    });

    // 3) Cargamos tickets de una (sin relaciones)
    const ticketIds = Array.from(
      new Set(cleaned.map((o) => o.ticket_id).filter(Boolean))
    );

    let tickets = [];
    if (ticketIds.length > 0) {
      const tRes = await supabase
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
            "seller_id",
            "seller_name",
            "seller_email",
            "seller_rut",
            "platform_fee",
            "created_at",
            "pdf_path",
            "ticket_pdf_path",
            "pdf_url",
          ].join(",")
        )
        .in("id", ticketIds);

      if (tRes.error) {
        console.error("[api/orders/my] tickets select error:", tRes.error);
        return Response.json({ error: tRes.error.message }, { status: 500 });
      }
      tickets = tRes.data ?? [];
    }

    const ticketsById = new Map(tickets.map((t) => [t.id, t]));

    // 4) Cargamos eventos asociados a esos tickets
    const eventIds = Array.from(
      new Set(tickets.map((t) => t.event_id).filter(Boolean))
    );

    let events = [];
    if (eventIds.length > 0) {
      const eRes = await supabase
        .from("events")
        .select(
          [
            "id",
            "title",
            "category",
            "venue",
            "city",
            "starts_at",
            "image_url",
            "created_at",
          ].join(",")
        )
        .in("id", eventIds);

      if (eRes.error) {
        console.error("[api/orders/my] events select error:", eRes.error);
        return Response.json({ error: eRes.error.message }, { status: 500 });
      }
      events = eRes.data ?? [];
    }

    const eventsById = new Map(events.map((e) => [e.id, e]));

    // 5) Embebemos ticket + event dentro de cada orden
    const enriched = cleaned
      .map((o) => {
        const ticket = o.ticket_id ? ticketsById.get(o.ticket_id) : null;
        const event = ticket?.event_id ? eventsById.get(ticket.event_id) : null;

        return {
          ...o,
          created_at: toIso(o.created_at),
          updated_at: toIso(o.updated_at),
          paid_at: o.paid_at ? toIso(o.paid_at) : null,
          ticket,
          event,
        };
      })
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    return Response.json({ orders: enriched }, { status: 200 });
  } catch (err) {
    console.error("[api/orders/my] unexpected error:", err);
    return Response.json({ error: "Error interno" }, { status: 500 });
  }
}


