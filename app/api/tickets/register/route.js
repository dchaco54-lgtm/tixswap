import { NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

// --- Supabase (SERVER ONLY) ---
function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) throw new Error("Missing env: NEXT_PUBLIC_SUPABASE_URL");
  if (!serviceKey) throw new Error("Missing env: SUPABASE_SERVICE_ROLE_KEY");

  return createClient(url, serviceKey, {
    auth: { persistSession: false },
  });
}

// Detecta si una columna existe consultando 1 registro (evita romperte por schema distinto)
async function columnExists(supabase, table, col) {
  const { error } = await supabase.from(table).select(col).limit(1);
  return !error;
}

// Elige el nombre real de la columna hash (en tu DB parece ser file_hash)
async function detectHashColumn(supabase) {
  const table = "ticket_uploads";
  const candidates = ["file_hash", "sha256"]; // prioridad: file_hash
  for (const col of candidates) {
    // eslint-disable-next-line no-await-in-loop
    if (await columnExists(supabase, table, col)) return col;
  }
  return "file_hash"; // fallback
}

export async function POST(req) {
  try {
    const supabase = getSupabaseAdmin();
    const formData = await req.formData();

    const file = formData.get("file");
    const sellerId = formData.get("sellerId") || null;

    // viene como string "true"/"false" desde FormData
    const isNominada = formData.get("isNominada") === "true";

    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "Archivo inválido" }, { status: 400 });
    }

    // --- Validaciones básicas ---
    const maxBytes = 8 * 1024 * 1024; // 8MB
    if (file.size > maxBytes) {
      return NextResponse.json(
        { error: "Máx 8MB. El archivo es demasiado grande." },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const bytes = Buffer.from(arrayBuffer);

    // PDF real: header %PDF
    const header = bytes.subarray(0, 4).toString("utf8");
    if (header !== "%PDF") {
      return NextResponse.json(
        { error: "El archivo no parece ser un PDF válido." },
        { status: 400 }
      );
    }

    // --- Hash anti-duplicado ---
    const hash = crypto.createHash("sha256").update(bytes).digest("hex");
    const hashCol = await detectHashColumn(supabase);

    // --- Dedupe (DB) ---
    const { data: existing, error: findErr } = await supabase
      .from("ticket_uploads")
      .select(`id, storage_bucket, storage_path, ${hashCol}`)
      .eq(hashCol, hash)
      .maybeSingle();

    if (findErr) {
      return NextResponse.json(
        { error: "DB error (dedupe)", details: findErr.message },
        { status: 500 }
      );
    }

    if (existing?.id) {
      return NextResponse.json(
        {
          error: "Entrada ya subida en Tixswap",
          existingId: existing.id,
          fileHash: hash,
          storagePath: existing.storage_path || null,
        },
        { status: 409 }
      );
    }

    // --- Storage upload ---
    // OJO: tu bucket se llama "ticket-pdfs" (lowercase) según tu screenshot
    const bucket = "ticket-pdfs";

    const safeName = (file.name || "ticket.pdf").replace(/[^a-zA-Z0-9._-]/g, "_");
    const storagePath = `tickets/${hash}/${Date.now()}_${safeName}`;

    const { error: uploadErr } = await supabase.storage.from(bucket).upload(storagePath, bytes, {
      contentType: "application/pdf",
      upsert: false,
    });

    if (uploadErr) {
      return NextResponse.json(
        { error: "Storage upload error", details: uploadErr.message },
        { status: 500 }
      );
    }

    // --- Insert DB ---
    // armamos payload mínimo y agregamos columnas SOLO si existen (para no reventar por schema cache / migraciones)
    const insertPayload = {
      [hashCol]: hash, // <<< ESTO arregla tu error: file_hash NOT NULL
      storage_bucket: bucket,
      storage_path: storagePath,
      original_name: file.name || null,
      mime_type: "application/pdf",
      file_size: bytes.length,
      status: "uploaded",
    };

    // seller_id (si existe la columna)
    if (sellerId && (await columnExists(supabase, "ticket_uploads", "seller_id"))) {
      insertPayload.seller_id = sellerId;
    }

    // is_nominada (si existe la columna)
    if (await columnExists(supabase, "ticket_uploads", "is_nominada")) {
      insertPayload.is_nominada = isNominada;
    }

    const { data: inserted, error: insErr } = await supabase
      .from("ticket_uploads")
      .insert(insertPayload)
      .select("id, storage_bucket, storage_path")
      .single();

    if (insErr) {
      // Si DB falla, limpiamos storage para no dejar basura
      await supabase.storage.from(bucket).remove([storagePath]).catch(() => {});
      return NextResponse.json(
        { error: "DB insert error", details: insErr.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      ticketUploadId: inserted.id,
      fileHash: hash,
      storageBucket: inserted.storage_bucket,
      storagePath: inserted.storage_path,
      isNominada,
    });
  } catch (e) {
    return NextResponse.json(
      { error: "Server error", details: e?.message || String(e) },
      { status: 500 }
    );
  }
}
