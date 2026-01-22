// app/api/tickets/my-listings/route.js
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error("Missing Supabase env vars");
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false },
});

/**
 * GET /api/tickets/my-listings
 * Obtener publicaciones (tickets) del seller autenticado
 */
export async function GET(request) {
  try {
    // Auth con bearer token
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

    // Schema-safe: verificar qué columnas existen en tickets
    const { data: columns } = await supabaseAdmin
      .from("information_schema.columns")
      .select("column_name")
      .eq("table_schema", "public")
      .eq("table_name", "tickets");

    const availableCols = new Set((columns || []).map((c) => c.column_name));

    // Columnas base siempre necesarias
    const selectCols = ["id", "created_at", "seller_id"];

    // Columnas opcionales según esquema
    const optionalCols = [
      "status",
      "price",
      "original_price",
      "currency",
      "event_id",
      "event_date",
      "title",
      "venue",
      "city",
      "section",
      "row",
      "seat",
      "is_named",
      "pdf_url",
      "storage_path",
      "notes",
    ];

    optionalCols.forEach((col) => {
      if (availableCols.has(col)) selectCols.push(col);
    });

    // Query principal
    const { data: tickets, error: ticketsErr } = await supabaseAdmin
      .from("tickets")
      .select(selectCols.join(", "))
      .eq("seller_id", userId)
      .order("created_at", { ascending: false })
      .limit(100); // Limitar a últimos 100 para performance

    if (ticketsErr) {
      console.error("[my-listings] Error fetching tickets:", ticketsErr);
      return NextResponse.json(
        { error: "Error al obtener publicaciones", details: ticketsErr.message },
        { status: 500 }
      );
    }

    // Calcular contadores
    const active = (tickets || []).filter((t) => t.status === "active" || t.status === "available").length;
    const paused = (tickets || []).filter((t) => t.status === "paused").length;
    const sold = (tickets || []).filter((t) => t.status === "sold").length;

    return NextResponse.json({
      tickets: tickets || [],
      summary: {
        total: tickets?.length || 0,
        active,
        paused,
        sold,
      },
    });
  } catch (err) {
    console.error("[my-listings] Unexpected error:", err);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
