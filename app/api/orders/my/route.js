// app/api/orders/my/route.js
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

async function getUserFromRequest(req) {
  try {
    // Método 1: Bearer token desde header (preferido)
    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;

    if (token) {
      const admin = supabaseAdmin();
      const { data, error } = await admin.auth.getUser(token);
      if (!error && data?.user) {
        return data.user;
      }
    }

    // Método 2: Fallback con REST endpoint
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const apiKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (token && supabaseUrl && apiKey) {
      const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
        headers: {
          apikey: apiKey,
          Authorization: `Bearer ${token}`,
        },
        cache: 'no-store',
      });

      if (res.ok) {
        const user = await res.json().catch(() => null);
        if (user?.id) return user;
      }
    }

    return null;
  } catch (err) {
    console.error('[getUserFromRequest] Error:', err);
    return null;
  }
}

/**
 * Devuelve las compras (orders) del usuario logeado.
 */
export async function GET(req) {
  try {
    console.log('[Orders/My] Iniciando...');
    
    const user = await getUserFromRequest(req);

    console.log('[Orders/My] User:', { hasUser: !!user, userId: user?.id });

    if (!user) {
      console.log('[Orders/My] Unauthorized - no user');
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = supabaseAdmin();

    console.log('[Orders/My] Buscando orders para userId:', user.id);

    // 1) orders del buyer
    const { data: orders, error: ordersError } = await admin
      .from("orders")
      .select("*")
      .eq("buyer_id", user.id)
      .order("created_at", { ascending: false });

    console.log('[Orders/My] Query result:', { 
      ordersCount: orders?.length || 0, 
      error: ordersError?.message || ordersError?.code 
    });

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
      const { data: tickets, error: ticketsError } = await admin
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
      const { data: events, error: eventsError } = await admin
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


