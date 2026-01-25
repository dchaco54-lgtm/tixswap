import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  buildTicketSelect,
  detectTicketColumns,
  normalizeTicket,
} from "@/lib/db/ticketSchema";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
  Pragma: "no-cache",
  Expires: "0",
};

export async function GET(req) {
  const supabase = await createClient();
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.replace("Bearer ", "").trim();

  try {
    // 1) Obtener userId desde el token
    let userId = null;

    if (token) {
      const admin = supabase;
      const { data: userRes, error: userErr } = await admin.auth.getUser(token);
      if (userErr || !userRes?.user) {
        return NextResponse.json(
          { error: "Sesión inválida" },
          { status: 401, headers: NO_STORE_HEADERS }
        );
      }
      userId = userRes.user.id;
    } else {
      // fallback: sesión cookie (server)
      const { data, error } = await supabase.auth.getUser();
      if (error || !data?.user) {
        return NextResponse.json(
          { error: "No autorizado" },
          { status: 401, headers: NO_STORE_HEADERS }
        );
      }
      userId = data.user.id;
    }

    // 2) Detectar columnas y armar select safe
    const cols = await detectTicketColumns(supabase);
    const select = buildTicketSelect(cols);

    // 3) Traer tickets del seller
    const { data: tickets, error: errTickets } = await supabase
      .from("tickets")
      .select(select)
      .eq("seller_id", userId)
      .order("created_at", { ascending: false });

    if (errTickets) {
      return NextResponse.json(
        { error: errTickets.message || "Error al traer tickets" },
        { status: 500, headers: NO_STORE_HEADERS }
      );
    }

    // 4) Normalizar para el front
    const normalized = (tickets || []).map((t) => normalizeTicket(t));

    // 5) Summary (opcional)
    const summary = {
      total: normalized.length,
      active: normalized.filter((t) => ["active", "available"].includes(t.status)).length,
      paused: normalized.filter((t) => t.status === "paused").length,
      sold: normalized.filter((t) => t.status === "sold").length,
    };

    return NextResponse.json({ tickets: normalized, summary }, { headers: NO_STORE_HEADERS });
  } catch (e) {
    return NextResponse.json(
      { error: e?.message || "Error inesperado" },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}

