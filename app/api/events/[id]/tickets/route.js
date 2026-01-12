import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "Missing env vars: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY"
    );
  }

  return createClient(url, serviceKey, {
    auth: { persistSession: false },
  });
}

async function columnExists(supabase, table, column) {
  const { error } = await supabase.from(table).select(column).limit(1);
  return !error;
}

export async function GET(_req, { params }) {
  try {
    const { id } = params || {};
    if (!id) {
      return NextResponse.json({ error: "Missing event id" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    let q = supabase
      .from("tickets")
      .select("*")
      .eq("event_id", id)
      .order("created_at", { ascending: false });

    // Filtrado seguro según columnas disponibles
    if (await columnExists(supabase, "tickets", "status")) {
      // Lo más típico en tu repo: active / available
      q = q.in("status", ["active", "available"]);
    } else if (await columnExists(supabase, "tickets", "is_sold")) {
      q = q.eq("is_sold", false);
    } else if (await columnExists(supabase, "tickets", "sold")) {
      q = q.eq("sold", false);
    }

    const { data, error } = await q;

    if (error) {
      return NextResponse.json(
        { error: "DB error", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ tickets: data ?? [] });
  } catch (e) {
    return NextResponse.json(
      { error: "Server error", details: e?.message ?? String(e) },
      { status: 500 }
    );
  }
}
