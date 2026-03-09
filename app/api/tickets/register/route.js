import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import {
  buildTicketUploadStagingPath,
  createTicketUploadSignedUrl,
  getTicketUploadEffectivePath,
} from "@/lib/ticketUploads";
import { ensureRequestPlaceholderEvent } from "@/lib/requestEventPlaceholders";

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

export async function POST(req) {
  try {
    const supabaseUrl = getEnv("NEXT_PUBLIC_SUPABASE_URL");
    const serviceKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl) return json({ error: "Missing NEXT_PUBLIC_SUPABASE_URL" }, 500);
    if (!serviceKey) return json({ error: "Missing SUPABASE_SERVICE_ROLE_KEY" }, 500);

    const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token) return json({ error: "No autorizado" }, 401);

    const { data: authData, error: authErr } = await supabaseAdmin.auth.getUser(token);
    if (authErr || !authData?.user) {
      return json({ error: "No autorizado" }, 401);
    }

    const authUser = authData.user;
    const form = await req.formData();
    const file = form.get("file");
    const sellerId = authUser.id;
    const userId = authUser.id;
    const requestedEventName = (form.get("requestedEventName") || "").toString().trim() || null;
    let eventId = (form.get("eventId") || "").toString().trim() || null;

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
      .select(
        "id,event_id,file_hash,sha256,storage_bucket,storage_path,storage_path_staging,storage_path_final,created_at"
      )
      .eq("file_hash", sha256)
      .maybeSingle();

    if (existingErr) {
      return json(
        { error: "DB duplicate-check failed", details: existingErr.message, hint: existingErr.hint },
        500
      );
    }

    const bucket = "ticket-pdfs";
    const uploadId = crypto.randomUUID();
    const storagePath = buildTicketUploadStagingPath({
      eventId,
      userId,
      uploadId,
      sha256,
    });

    if (existing) {
      const signedUrl = await createTicketUploadSignedUrl(supabaseAdmin, existing, 60 * 30);
      const effectivePath = getTicketUploadEffectivePath(existing);

      return json(
        {
          error: "DUPLICATE",
          message: "Entrada ya subida en Tixswap",
          sha256,
          ticketUploadId: existing.id,
          uploadId: existing.id,
          eventId: existing.event_id || eventId || null,
          storagePath: effectivePath,
          signedUrl,
          filePath: effectivePath,
          viewUrl: signedUrl,
          createdAt: existing.created_at,
        },
        409
      );
    }

    if (!eventId && requestedEventName) {
      const placeholderEvent = await ensureRequestPlaceholderEvent(supabaseAdmin, {
        eventId: null,
        requestedEventName,
      });
      eventId = placeholderEvent.id;
    }

    if (!eventId) {
      return json({ error: "Falta eventId" }, 400);
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
      event_id: eventId,
      ticket_id: null,
      file_hash: sha256,
      sha256: sha256, // existe en tu tabla, aunque antes lo dejabas null
      storage_bucket: bucket,
      storage_path: storagePath,
      storage_path_staging: storagePath,
      storage_path_final: null,
      original_name: file.name || null,
      original_filename: null, // lo mantienes null en tu ejemplo
      filename_original: file.name || null,
      file_size: file.size,
      size_bytes: file.size,
      mime_type: file.type,
      is_nominated: isNominated,
      is_nominada: isNominated,
      seller_id: sellerId || null,
      status: "staging",
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
      .select(
        "id,created_at,storage_bucket,storage_path,storage_path_staging,storage_path_final"
      )
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
    const signedUrl = await createTicketUploadSignedUrl(
      supabaseAdmin,
      {
        ...inserted,
        storage_bucket: bucket,
      },
      60 * 30
    );

    return json({
      ok: true,
      ticketUploadId: inserted.id,
      uploadId: inserted.id,
      sha256,
      storagePath,
      signedUrl,
      filePath: storagePath,
      viewUrl: signedUrl,
      createdAt: inserted.created_at,
      summary: {
        bucket,
        eventId,
        isNominated,
      },
      eventId,
      eventName: requestedEventName || null,
      parsed: null, // si después quieres parsear QR en backend, lo agregamos aquí sin romper nada
    });
  } catch (e) {
    return json({ error: "Unexpected error", details: e?.message || String(e) }, 500);
  }
}
