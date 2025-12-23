import { NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

const BUCKET = "ticket-pdfs"; // ✅ debe existir EXACTO (case-sensitive)
const MAX_BYTES = 8 * 1024 * 1024;

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL missing");
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY missing");

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function POST(req) {
  try {
    const supabase = getSupabaseAdmin();

    const form = await req.formData();
    const file = form.get("file");
    const metaRaw = form.get("meta");

    if (!file) {
      return NextResponse.json({ error: "Falta el archivo (file)." }, { status: 400 });
    }
    if (typeof file === "string") {
      return NextResponse.json({ error: "Archivo inválido." }, { status: 400 });
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "Máx 8MB." }, { status: 400 });
    }

    const ab = await file.arrayBuffer();
    const buf = Buffer.from(ab);

    // Validación mínima de PDF
    const header = buf.subarray(0, 5).toString("utf8");
    if (header !== "%PDF-") {
      return NextResponse.json({ error: "El archivo no parece ser un PDF válido." }, { status: 400 });
    }

    // Hash anti-duplicado
    const hash = crypto.createHash("sha256").update(buf).digest("hex");

    let meta = {};
    try {
      meta = metaRaw ? JSON.parse(String(metaRaw)) : {};
    } catch {
      meta = {};
    }

    // Tabla donde guardamos uploads (anti-duplicado)
    // Asegúrate de crearla con el SQL de abajo
    const { data: existing, error: findErr } = await supabase
      .from("ticket_uploads")
      .select("id, storage_path")
      .eq("file_hash", hash)
      .maybeSingle();

    if (findErr) {
      return NextResponse.json({ error: `DB error (lookup): ${findErr.message}` }, { status: 500 });
    }
    if (existing) {
      return NextResponse.json(
        { error: "Entrada ya subida en Tixswap.", code: "DUPLICATE", existing },
        { status: 409 }
      );
    }

    const userId = meta?.userId || "anon";
    const storagePath = `${userId}/${hash}.pdf`;

    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, buf, {
        contentType: "application/pdf",
        upsert: false,
      });

    if (upErr) {
      return NextResponse.json({ error: `Storage error: ${upErr.message}` }, { status: 500 });
    }

    const { data: ins, error: insErr } = await supabase
      .from("ticket_uploads")
      .insert({
        user_id: meta?.userId ?? null,
        file_hash: hash,
        storage_bucket: BUCKET,
        storage_path: storagePath,
        original_filename: file.name ?? null,
        file_size: file.size ?? null,
        is_nominated: !!meta?.isNominated,
        meta: meta ?? {},
      })
      .select("id, storage_path, file_hash")
      .single();

    if (insErr) {
      return NextResponse.json({ error: `DB error (insert): ${insErr.message}` }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      upload: ins,
    });
  } catch (e) {
    return NextResponse.json({ error: e?.message || "Unknown error" }, { status: 500 });
  }
}
