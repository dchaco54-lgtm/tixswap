// app/api/tickets/my-listings/route.js
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { buildTicketSelect, detectTicketColumns, normalizeTicket } from '@/lib/db/ticketSchema';

export const dynamic = "force-dynamic";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error("Missing Supabase env vars");
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false },
});

export async function GET(request) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: authData, error: authErr } = await supabaseAdmin.auth.getUser(token);
    if (authErr || !authData?.user) {
      return NextResponse.json({ error: "Sesión inválida" }, { status: 401 });
    }

    const userId = authData.user.id;

    const columns = await detectTicketColumns(supabaseAdmin);
    const selectStr = buildTicketSelect(columns);

    const { data: tickets, error: ticketsErr } = await supabaseAdmin
      .from("tickets")
      .select(selectStr)
      .eq("seller_id", userId)
      .order("created_at", { ascending: false })
      .limit(100);

    if (ticketsErr) {
      console.error("[my-listings] Error fetching tickets:", ticketsErr);
      return NextResponse.json(
        { error: "Error al obtener publicaciones", details: ticketsErr.message },
        { status: 500 }
      );
    }

    const normTickets = (tickets || []).map(normalizeTicket);

    const active = normTickets.filter((t) => t.status === "active" || t.status === "available").length;
    const paused = normTickets.filter((t) => t.status === "paused").length;
    const sold = normTickets.filter((t) => t.status === "sold").length;

    return NextResponse.json({
      tickets: normTickets,
      summary: { total: normTickets.length, active, paused, sold },
    });
  } catch (err) {
    console.error("[my-listings] Unexpected error:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

