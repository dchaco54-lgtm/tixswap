import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

export const runtime = "nodejs"; // necesario para crypto + Buffer

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function getEnv(name) {
  const v = process.env[name];
  return v && String(v).trim().length ? String(v).trim() : null;
}

function safeFileName(name) {
  // deja letras/números/._- y reemplaza espacios
  return String(name || "ticket.pdf")
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9._-]/g, "")
    .slice(0, 180);
}

export async function POST(req) {
  try {
    const supabaseUrl = getEnv("NEXT_PUBLIC_SUPABASE_URL");
    const serviceKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl) return json({ error: "Missing NEXT_PUBLIC_SUPABASE_URL" }, 500);
    if (!serviceKey) return json({ error: "Missing SUPABASE_SERVICE_ROLE_KEY" }, 500);

    const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    const form = await req.formData();
    const file = form.get("file");

    // OJO: esto es el “seller” (quien sube el ticket)
    const sellerId = (form.get("sellerId") || "").toString() || null;
    const userId = (form.get("userId") || "").toString() || null;

    // vienen con distintos nombres según pantallas
    const isNominated =
      (form.get("isNominated") || form.get("isNominada") || "false").toString() === "true";

    const qrPayload = (form.get("qr_payload") || "").toString() || "";

    // Opcional: si en algún flujo te llegan estos, los guardamos donde corresponde
    const buyerName = (form.get("buyer_name") || "").toString() || null;
    const buyerRut = (form.get("buyer_rut") || "").toString() || null;

    if (!file) return json({ error: "Missing file" }, 400);
    if (!(file instanceof File)) return json({ error: "Invalid file" }, 400);

    if (file.type !== "application/pdf") {
      return json({ error: "Solo PDF (application/pdf)" }, 400);
    }

    const maxBytes = 8 * 1024 * 1024;
    if (file.size > maxBytes) {
      return json({ error: "PDF supera 8MB" }, 400);
    }

    const ab = await file.arrayBuffer();
    const buf = Buffer.from(ab);

    // header PDF real
    const header = buf.subarray(0, 5).toString("utf8");
    if (header !== "%PDF-") {
      return json({ error: "Archivo no parece un PDF válido" }, 400);
    }

    // Hash anti-duplicado
    const sha256 = crypto.createHash("sha256").update(buf).digest("hex");

    // Tabla real usa file_hash (y también tiene sha256, pero históricamente lo tienes null)
    // 1) Duplicado en DB
    const { data: existing, error: existingErr } = await supabaseAdmin
      .from("ticket_uploads")
      .select("id, file_hash, storage_bucket, storage_path, created_at")
      .eq("file_hash", sha256)
      .maybeSingle();

    if (existingErr) {
      return json(
        { error: "DB duplicate-check failed", details: existingErr.message, hint: existingErr.hint },
        500
      );
    }

    const bucket = "ticket-pdfs"; // ✅ tu bucket real
    const ts = Date.now();
    const cleanName = safeFileName(file.name || "ticket.pdf");
    const storagePath = `tickets/${sha256}/${ts}_${cleanName}`; // ✅ tu formato real

    if (existing) {
      // signed url para verlo
      const { data: signed, error: signedErr } = await supabaseAdmin.storage
        .from(bucket)
        .createSignedUrl(existing.storage_path, 60 * 30);

      return json(
        {
          error: "DUPLICATE",
          message: "Entrada ya subida en Tixswap",
          sha256,
          ticketUploadId: existing.id,
          filePath: existing.storage_path,
          viewUrl: signedErr ? null : signed?.signedUrl || null,
          createdAt: existing.created_at,
        },
        409
      );
    }

    // 2) Subir a Storage
    const { error: uploadErr } = await supabaseAdmin.storage.from(bucket).upload(storagePath, buf, {
      contentType: "application/pdf",
      upsert: false,
    });

    if (uploadErr) {
      return json(
        { error: "Storage upload failed", details: uploadErr.message, hint: uploadErr.hint },
        500
      );
    }

    // 3) Insert DB (ALINEADO A TU ESQUEMA REAL)
    const insertPayload = {
      user_id: userId || null,
      file_hash: sha256,
      sha256: sha256, // existe en tu tabla, aunque antes lo dejabas null
      storage_bucket: bucket,
      storage_path: storagePath,
      original_name: file.name || null,
      original_filename: null, // lo mantienes null en tu ejemplo
      file_size: file.size,
      mime_type: file.type,
      is_nominated: isNominated,
      is_nominada: isNominated,
      seller_id: sellerId || null,
      status: "uploaded",
      qr_payload: qrPayload || "",
      // buyer_* NO existe => usamos attendee_*
      attendee_name: buyerName,
      attendee_rut: buyerRut,
      // meta como JSON para debug (tu tabla tiene meta)
      meta: {
        debug: {
          uploadedAt: new Date().toISOString(),
          fileName: file.name,
          fileSize: file.size,
          hasQR: Boolean(qrPayload && qrPayload.length),
          qrLength: qrPayload ? qrPayload.length : 0,
        },
      },
    };

    const { data: inserted, error: insertErr } = await supabaseAdmin
      .from("ticket_uploads")
      .insert(insertPayload)
      .select("id, created_at, storage_path")
      .single();

    if (insertErr) {
      // rollback storage
      await supabaseAdmin.storage.from(bucket).remove([storagePath]);
      return json(
        { error: "DB insert failed", details: insertErr.message, hint: insertErr.hint },
        500
      );
    }

    // 4) Signed URL para ver/descargar
    const { data: signed, error: signedErr } = await supabaseAdmin.storage
      .from(bucket)
      .createSignedUrl(storagePath, 60 * 30);

    return json({
      ok: true,
      ticketUploadId: inserted.id,
      sha256,
      filePath: storagePath,
      viewUrl: signedErr ? null : signed?.signedUrl || null,
      createdAt: inserted.created_at,
      summary: {
        bucket,
        isNominated,
      },
      parsed: null, // si después quieres parsear QR en backend, lo agregamos aquí sin romper nada
    });
  } catch (e) {
    return json({ error: "Unexpected error", details: e?.message || String(e) }, 500);
  }
}

