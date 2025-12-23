import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL missing");
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY missing");

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// Espera JSON (como lo manda tu page.jsx)
export async function POST(req) {
  try {
    const body = await req.json();

    const {
      sha256,
      storage_path,
      event_id,
      owner_user_id,
      original_filename,
      size_bytes,
      is_nominated,
    } = body || {};

    if (!sha256) return NextResponse.json({ error: "sha256 is required" }, { status: 400 });
    if (!storage_path) return NextResponse.json({ error: "storage_path is required" }, { status: 400 });
    if (!event_id) return NextResponse.json({ error: "event_id is required" }, { status: 400 });
    if (!owner_user_id) return NextResponse.json({ error: "owner_user_id is required" }, { status: 400 });

    const supabase = supabaseAdmin();

    // 1) si ya existe => 409
    const { data: existing, error: findErr } = await supabase
      .from("ticket_uploads")
      .select("id, sha256, storage_path")
      .eq("sha256", sha256)
      .maybeSingle();

    if (findErr) {
      return NextResponse.json({ error: `DB lookup error: ${findErr.message}` }, { status: 500 });
    }

    if (existing) {
      return NextResponse.json({ error: "Entrada ya subida en Tixswap" }, { status: 409 });
    }

    // 2) inserta
    const { data: inserted, error: insErr } = await supabase
      .from("ticket_uploads")
      .insert({
        sha256,
        storage_bucket: "ticket-pdfs",
        storage_path,
        event_id,
        owner_user_id,
        original_filename: original_filename || null,
        size_bytes: size_bytes || null,
        is_nominated: !!is_nominated,
      })
      .select("id, sha256, storage_path")
      .single();

    if (insErr) {
      return NextResponse.json({ error: `DB insert error: ${insErr.message}` }, { status: 500 });
    }

    return NextResponse.json({ ok: true, ticket: inserted }, { status: 200 });
  } catch (e) {
    return NextResponse.json(
      { error: e?.message || "Unknown error in /api/tickets/register" },
      { status: 500 }
    );
  }
}
