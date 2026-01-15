// app/api/orders/my/route.js
export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * Devuelve las compras (orders) del usuario logeado.
 * - Auth por cookies (lo normal en el navegador).
 * - Si existe SERVICE ROLE, lo usa para evitar dramas de RLS.
 * - Si no existen FK (joins), arma la data manualmente con maps (robusto).
 */
export async function GET() {
  try {
    const cookieStore = cookies();
    const supabaseUser = createRouteHandlerClient({ cookies: () => cookieStore });

    const {
      data: { user },
      error: userError,
    } = await supabaseUser.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let admin = null;
    try {
      admin = supabaseAdmin();
    } catch {
      // sin SERVICE KEY, seguimos con el client del usuario
    }

    const client = admin || supabaseUser;

    // 1) orders del buyer
    const { data: orders, error: ordersError } = await client
      .from("orders")
      .select("*")
      .eq("buyer_id", user.id)
      .order("created_at", { ascending: false });

    if (ordersError) {
      console.error("orders/my ordersError:", ordersError);
      return NextResponse.json({ error: "Error cargando compras." }, { status: 500 });
    }

    const safeOrders = orders || [];

    // 2) tickets por ticket_id
    const ticketIds = Array.from(
      new Set(safeOrders.map((o) => o.ticket_id).filter(Boolean))
    );

    let ticketsById = {};
    if (ticketIds.length) {
      const { data: tickets, error: ticketsError } = await client
        .from("tickets")
        .select("*")
        .in("id", ticketIds);

      if (ticketsError) {
        console.warn("orders/my ticketsError (seguimos igual):", ticketsError);
      } else {
        ticketsById = Object.fromEntries((tickets || []).map((t) => [t.id, t]));
      }
    }

    // 3) events (desde orders.event_id o ticket.event_id)
    const eventIds = Array.from(
      new Set(
        safeOrders
          .map((o) => o.event_id)
          .concat(Object.values(ticketsById).map((t) => t?.event_id))
          .filter(Boolean)
      )
    );

    let eventsById = {};
    if (eventIds.length) {
      const { data: events, error: eventsError } = await client
        .from("events")
        .select("*")
        .in("id", eventIds);

      if (eventsError) {
        console.warn("orders/my eventsError (seguimos igual):", eventsError);
      } else {
        eventsById = Object.fromEntries((events || []).map((e) => [e.id, e]));
      }
    }

    const enriched = safeOrders.map((o) => {
      const ticket = o.ticket_id ? ticketsById[o.ticket_id] : null;
      const event = o.event_id
        ? eventsById[o.event_id]
        : ticket?.event_id
          ? eventsById[ticket.event_id]
          : null;

      return {
        ...o,
        ticket: ticket || null,
        event: event || null,
      };
    });

    return NextResponse.json({ orders: enriched });
  } catch (err) {
    console.error("orders/my fatal error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}


