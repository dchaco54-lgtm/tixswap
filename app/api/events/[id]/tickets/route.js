import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = 'force-dynamic';
export const runtime = "nodejs";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    const missing = [];
    if (!url) missing.push("NEXT_PUBLIC_SUPABASE_URL (o SUPABASE_URL)");
    if (!serviceKey) missing.push("SUPABASE_SERVICE_ROLE_KEY");
    throw new Error(`Supabase Admin Client not configured. Missing: ${missing.join(", ")}`);
  }

  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

async function columnExists(supabase, table, column) {
  try {
    const { error } = await supabase.from(table).select(column).limit(1);
    return !error;
  } catch {
    return false;
  }
}

export async function GET(_req, { params }) {
  try {
    const id = params?.id;
    if (!id) return NextResponse.json({ error: "Missing event id" }, { status: 400 });

    const supabase = getSupabaseAdmin();

    let q = supabase
      .from("tickets")
      .select("*")
      .eq("event_id", id)
      .order("created_at", { ascending: false });

    // ✅ Status robusto: soporta el enum del repo (active/held/sold)
    // y además variantes típicas si alguna vez guardaste en español.
    if (await columnExists(supabase, "tickets", "status")) {
      const visible = [
        "active", "available", "held",
        "ACTIVE", "AVAILABLE", "HELD",
        "Active", "Available", "Held",
        "activo", "disponible", "reservado",
        "ACTIVO", "DISPONIBLE", "RESERVADO",
        "Activo", "Disponible", "Reservado",
      ];
      q = q.in("status", visible);
    }

    const { data, error } = await q;

    if (error) {
      return NextResponse.json(
        { error: error.message, hint: error.hint, details: error.details, code: error.code },
        { status: 500 }
      );
    }

    return NextResponse.json({ tickets: data || [] }, { status: 200 });
  } catch (err) {
    return NextResponse.json({ error: err?.message || "Unexpected error" }, { status: 500 });
  }
}

