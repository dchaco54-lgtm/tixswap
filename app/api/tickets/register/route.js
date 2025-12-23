import { NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) throw new Error("Missing env: NEXT_PUBLIC_SUPABASE_URL");
  if (!key) throw new Error("Missing env: SUPABASE_SERVICE_ROLE_KEY");

  return createClient(url, key, { auth: { persistSession: false } });
}

function toBool(v) {
  const s = String(v ?? "").toLowerCase().trim();
  return s === "true" || s === "1" || s === "on" || s === "yes";
}

export async function POST(req) {
  try {
    const supabase = getSupabaseAdmin();
    const formData = await req.formData();

    const file = formData.get("file");
    // ✅ acá va la lógica de nominada (NO body, porque es FormData)
    const isNominada = toBool(formData.get("isNominada"));
    const sellerId = formData.get("sellerId") || null;

    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "Archivo inválido" }, { status: 400 });
    }

    // Validación básica
    const mime = file.type || "";
    if (!mime.includes("pdf")) {
      return NextResponse.json({ error: "El archivo debe ser PDF" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const bytes = Buffer.from(arrayBuffer);

    // Hash anti-duplicado
    const sha256 = crypto.createHash("sha256").update(bytes).digest("hex");

    // 1) Ver si ya existe por hash
    const { data: existing, error: findErr } = await supabase
      .from("ticket_uploads")
      .select("id, storage_path, sha256")
      .eq("sha256", sha256)
      .maybeSingle();

    if (findErr) {
      return NextResponse.json({ error: "DB error", details: findErr.message }, { status: 500 });
    }

    if (existing?.id) {
      return NextResponse.json(
        { error: "Entrada ya subida en Tixswap", sha256, existingId: existing.id },
        { status: 409 }
      );
    }

    // 2) Subir a Storage
    const bucket = "ticket-pdfs";
    const fileNameSafe = (file.name || "ticket.pdf").replace(/[^a-zA-Z0-9._-]/g, "_");
    const storagePath = `tickets/${sha256}/${Date.now()}_${fileNameSafe}`;

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

    // 3) Registrar en tabla
    const { data: inserted, error: insErr } = await supabase
      .from("ticket_uploads")
      .insert({
        sha256,
        storage_bucket: bucket,
        storage_path: storagePath,
        original_name: file.name || null,
        mime_type: "application/pdf",
        file_size: bytes.length,
        is_nominada: isNominada, // ✅ si no hay check => false (por defecto)
        seller_id: sellerId,
        status: "uploaded",
      })
      .select("id, sha256, storage_path")
      .single();

    if (insErr) {
      // Si falla DB, limpiamos Storage para no dejar basura
      await supabase.storage.from(bucket).remove([storagePath]).catch(() => {});
      return NextResponse.json({ error: "DB insert error", details: insErr.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      ticketUploadId: inserted.id,
      sha256: inserted.sha256,
      storagePath: inserted.storage_path,
      isNominada: isNominada,
    });
  } catch (e) {
    return NextResponse.json(
      { error: "Server error", details: e?.message || String(e) },
      { status: 500 }
    );
  }
}
