// app/api/tickets/my-publications/route.js
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { buildTicketSelect, detectTicketColumns, normalizeTicket } from "@/lib/db/ticketSchema";

export async function GET(request) {
  try {
    const admin = supabaseAdmin();

    // 1) Resolver userId: Bearer token (preferido) o cookies (fallback)
    let userId = null;
    const authHeader = request.headers.get("authorization") || "";

    if (authHeader.toLowerCase().startsWith("bearer ")) {
      const token = authHeader.slice(7).trim();
      const { data: userRes, error: userErr } = await admin.auth.getUser(token);

      if (userErr || !userRes?.user) {
        return NextResponse.json({ error: "Sesión inválida" }, { status: 401 });
      }
      userId = userRes.user.id;
    } else {
      const supabase = createClient(cookies());
      const { data: { user }, error: userErr } = await supabase.auth.getUser();

      if (userErr || !user) {
        return NextResponse.json({ error: "No autorizado" }, { status: 401 });
      }
      userId = user.id;
    }

    // 2) Detectar columnas reales y armar select seguro
    const columns = await detectTicketColumns(admin, "tickets");
    const selectStr = buildTicketSelect(columns);

    // 3) Filtro por seller (detecta columna real)
    const sellerCol =
      ["seller_id", "owner_id", "user_id"].find((c) => columns.has(c)) || "seller_id";

    // 4) Query con admin (evita RLS raras: SIEMPRE verás sold/paused)
    let { data: tickets, error: ticketsErr } = await admin
      .from("tickets")
      .select(selectStr)
      .eq(sellerCol, userId)
      .order("created_at", { ascending: false })
      .limit(200);

    // Fallback si el embed event:events(...) falla por relación
    if (ticketsErr) {
      const msg = String(ticketsErr.message || "");
      const looksLikeRelationErr =
        /relationship|schema cache|Could not find/i.test(msg) && /events?/i.test(msg);

      if (!looksLikeRelationErr) {
        return NextResponse.json(
          { error: "Error al obtener publicaciones", details: msg },
          { status: 500, headers: { "Cache-Control": "no-store" } }
        );
      }

      const selectNoEmbed = selectStr.replace(/,\s*event:events\([^)]*\)\s*$/i, "");

      const retry = await admin
        .from("tickets")
        .select(selectNoEmbed)
        .eq(sellerCol, userId)
        .order("created_at", { ascending: false })
        .limit(200);

      if (retry.error) {
        return NextResponse.json(
          { error: "Error al obtener publicaciones", details: String(retry.error.message || "") },
          { status: 500, headers: { "Cache-Control": "no-store" } }
        );
      }

      tickets = retry.data || [];

      // armar eventos aparte
      const eventIds = Array.from(new Set((tickets || []).map((t) => t?.event_id).filter(Boolean)));
      if (eventIds.length) {
        const { data: events, error: eErr } = await admin
          .from("events")
          .select("id,title,starts_at,venue,city")
          .in("id", eventIds);

        if (!eErr && Array.isArray(events)) {
          const map = Object.fromEntries(events.map((e) => [e.id, e]));
          tickets = (tickets || []).map((t) => ({ ...t, event: map[t.event_id] || null }));
        }
      }
    }

    const normTickets = (tickets || []).map(normalizeTicket);

    const active = normTickets.filter((t) => t.status === "active").length;
    const paused = normTickets.filter((t) => t.status === "paused").length;
    const sold = normTickets.filter((t) => t.status === "sold").length;

    return NextResponse.json(
      { tickets: normTickets, summary: { total: normTickets.length, active, paused, sold } },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error("Error en GET /api/tickets/my-publications:", err);
    return NextResponse.json(
      { error: "Error inesperado", details: err?.message || String(err) },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
