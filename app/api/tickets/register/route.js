import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import {
  buildTicketUploadStagingPath,
  createTicketUploadSignedUrl,
  getTicketUploadEffectivePath,
} from "@/lib/ticketUploads";
import { tableHasColumn } from "@/lib/db/schemaColumns";
import { ensureRequestPlaceholderEvent } from "@/lib/requestEventPlaceholders";

export const runtime = "nodejs"; // necesario para crypto + Buffer

const TICKET_UPLOADS_TABLE = "ticket_uploads";
const TICKET_UPLOAD_COLUMN_CANDIDATES = [
  "id",
  "created_at",
  "event_id",
  "ticket_id",
  "user_id",
  "seller_id",
  "file_hash",
  "sha256",
  "storage_bucket",
  "storage_path",
  "storage_path_staging",
  "storage_path_final",
  "file_path",
  "status",
  "original_name",
  "original_filename",
  "filename_original",
  "file_size",
  "size_bytes",
  "mime_type",
  "is_nominated",
  "is_nominada",
  "qr_payload",
  "attendee_name",
  "attendee_rut",
  "meta",
];
const warnedMissingColumns = new Set();

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

function looksLikePdf(file) {
  const mime = String(file?.type || "").toLowerCase();
  const name = String(file?.name || "").toLowerCase();
  return mime === "application/pdf" || name.endsWith(".pdf");
}

function warnMissingColumn(tableName, columnName) {
  const key = `${tableName}.${columnName}`;
  if (warnedMissingColumns.has(key)) return;
  warnedMissingColumns.add(key);
  console.warn(`[tickets/register] missing column ${tableName}.${columnName}, using legacy-compatible flow`);
}

async function getExistingColumns(supabase, tableName, candidateColumns) {
  const columns = Array.from(new Set((candidateColumns || []).filter(Boolean)));
  const existing = new Set();

  try {
    const { data, error } = await supabase
      .from("information_schema.columns")
      .select("column_name")
      .eq("table_schema", "public")
      .eq("table_name", tableName)
      .in("column_name", columns);

    if (!error && Array.isArray(data)) {
      for (const row of data) {
        if (row?.column_name) existing.add(row.column_name);
      }
    }
  } catch {
    // noop
  }

  if (existing.size === 0) {
    for (const columnName of columns) {
      if (await tableHasColumn(supabase, tableName, columnName)) {
        existing.add(columnName);
      }
    }
  }

  for (const columnName of columns) {
    if (!existing.has(columnName)) {
      warnMissingColumn(tableName, columnName);
    }
  }

  return existing;
}

function pickExistingColumns(existingColumns, desiredColumns) {
  return desiredColumns.filter((columnName) => existingColumns.has(columnName));
}

function setIfColumnExists(target, existingColumns, columnName, value) {
  if (!existingColumns.has(columnName)) return;
  target[columnName] = value;
}

function buildUploadRecord(row, fallback = {}) {
  return {
    ...fallback,
    ...(row || {}),
  };
}

async function findExistingUploadByHash(supabase, existingColumns, sha256) {
  const duplicateSelect = pickExistingColumns(existingColumns, [
    "id",
    "created_at",
    "event_id",
    "file_hash",
    "sha256",
    "storage_bucket",
    "storage_path",
    "storage_path_staging",
    "storage_path_final",
    "file_path",
    "status",
    "ticket_id",
  ]);

  if (duplicateSelect.length === 0) {
    return { existing: null, existingErr: null };
  }

  const hashFilters = [];
  if (existingColumns.has("file_hash")) hashFilters.push(`file_hash.eq.${sha256}`);
  if (existingColumns.has("sha256")) hashFilters.push(`sha256.eq.${sha256}`);

  if (hashFilters.length === 0) {
    warnMissingColumn(TICKET_UPLOADS_TABLE, "file_hash");
    warnMissingColumn(TICKET_UPLOADS_TABLE, "sha256");
    return { existing: null, existingErr: null };
  }

  let query = supabase.from(TICKET_UPLOADS_TABLE).select(duplicateSelect.join(","));
  query = hashFilters.length === 1 ? query.or(hashFilters[0]) : query.or(hashFilters.join(","));

  const { data: existing, error: existingErr } = await query.maybeSingle();
  return { existing, existingErr };
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

    const isNominated =
      (form.get("isNominated") || form.get("isNominada") || "false").toString() === "true";
    const qrPayload = (form.get("qr_payload") || "").toString() || "";
    const buyerName = (form.get("buyer_name") || "").toString() || null;
    const buyerRut = (form.get("buyer_rut") || "").toString() || null;

    if (!file) return json({ error: "Missing file" }, 400);
    if (!(file instanceof File)) return json({ error: "Invalid file" }, 400);

    if (!looksLikePdf(file)) {
      return json({ error: "Solo PDF" }, 400);
    }

    const maxBytes = 8 * 1024 * 1024;
    if (file.size > maxBytes) {
      return json({ error: "PDF supera 8MB" }, 400);
    }

    const ab = await file.arrayBuffer();
    const buf = Buffer.from(ab);

    const header = buf.subarray(0, 5).toString("utf8");
    if (header !== "%PDF-") {
      return json({ error: "Archivo no parece un PDF válido" }, 400);
    }

    const sha256 = crypto.createHash("sha256").update(buf).digest("hex");
    const existingColumns = await getExistingColumns(
      supabaseAdmin,
      TICKET_UPLOADS_TABLE,
      TICKET_UPLOAD_COLUMN_CANDIDATES
    );

    const { existing, existingErr } = await findExistingUploadByHash(
      supabaseAdmin,
      existingColumns,
      sha256
    );

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
      const existingUpload = buildUploadRecord(existing, {
        storage_bucket: bucket,
      });
      const signedUrl = await createTicketUploadSignedUrl(supabaseAdmin, existingUpload, 60 * 30);
      const effectivePath = getTicketUploadEffectivePath(existingUpload);

      return json(
        {
          error: "DUPLICATE",
          message: "Entrada ya subida en Tixswap",
          sha256,
          ticketUploadId: existing.id,
          uploadId: existing.id,
          eventId: existingColumns.has("event_id") ? existing?.event_id ?? eventId ?? null : eventId,
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

    const insertPayload = {};
    setIfColumnExists(insertPayload, existingColumns, "user_id", userId || null);
    setIfColumnExists(insertPayload, existingColumns, "seller_id", sellerId || null);
    setIfColumnExists(insertPayload, existingColumns, "ticket_id", null);
    setIfColumnExists(insertPayload, existingColumns, "event_id", eventId);
    setIfColumnExists(insertPayload, existingColumns, "file_hash", sha256);
    setIfColumnExists(insertPayload, existingColumns, "sha256", sha256);
    setIfColumnExists(insertPayload, existingColumns, "storage_bucket", bucket);
    setIfColumnExists(insertPayload, existingColumns, "storage_path", storagePath);
    setIfColumnExists(insertPayload, existingColumns, "storage_path_staging", storagePath);
    setIfColumnExists(insertPayload, existingColumns, "storage_path_final", null);
    setIfColumnExists(insertPayload, existingColumns, "file_path", storagePath);
    setIfColumnExists(insertPayload, existingColumns, "original_name", file.name || null);
    setIfColumnExists(insertPayload, existingColumns, "original_filename", file.name || null);
    setIfColumnExists(insertPayload, existingColumns, "filename_original", file.name || null);
    setIfColumnExists(insertPayload, existingColumns, "file_size", file.size);
    setIfColumnExists(insertPayload, existingColumns, "size_bytes", file.size);
    setIfColumnExists(insertPayload, existingColumns, "mime_type", file.type || "application/pdf");
    setIfColumnExists(insertPayload, existingColumns, "is_nominated", isNominated);
    setIfColumnExists(insertPayload, existingColumns, "is_nominada", isNominated);
    setIfColumnExists(insertPayload, existingColumns, "status", "staging");
    setIfColumnExists(insertPayload, existingColumns, "qr_payload", qrPayload || "");
    setIfColumnExists(insertPayload, existingColumns, "attendee_name", buyerName);
    setIfColumnExists(insertPayload, existingColumns, "attendee_rut", buyerRut);
    setIfColumnExists(insertPayload, existingColumns, "meta", {
      debug: {
        uploadedAt: new Date().toISOString(),
        fileName: file.name,
        fileSize: file.size,
        hasQR: Boolean(qrPayload && qrPayload.length),
        qrLength: qrPayload ? qrPayload.length : 0,
      },
    });

    const insertSelect = pickExistingColumns(existingColumns, [
      "id",
      "created_at",
      "event_id",
      "storage_bucket",
      "storage_path",
      "storage_path_staging",
      "storage_path_final",
      "file_path",
      "ticket_id",
      "status",
    ]);

    const insertQuery = supabaseAdmin.from(TICKET_UPLOADS_TABLE).insert(insertPayload);
    const { data: inserted, error: insertErr } =
      insertSelect.length > 0
        ? await insertQuery.select(insertSelect.join(",")).single()
        : await insertQuery.select("id").single();

    if (insertErr) {
      await supabaseAdmin.storage.from(bucket).remove([storagePath]);
      return json(
        { error: "DB insert failed", details: insertErr.message, hint: insertErr.hint },
        500
      );
    }

    const insertedUpload = buildUploadRecord(inserted, {
      storage_bucket: bucket,
      storage_path: existingColumns.has("storage_path") ? storagePath : null,
      storage_path_staging: existingColumns.has("storage_path_staging") ? storagePath : null,
      storage_path_final: null,
      file_path: existingColumns.has("file_path") ? storagePath : null,
    });
    const signedUrl = await createTicketUploadSignedUrl(supabaseAdmin, insertedUpload, 60 * 30);
    const effectivePath = getTicketUploadEffectivePath(insertedUpload) || storagePath;

    return json({
      ok: true,
      ticketUploadId: inserted?.id || null,
      uploadId: inserted?.id || null,
      sha256,
      storagePath: effectivePath,
      signedUrl,
      filePath: effectivePath,
      viewUrl: signedUrl,
      createdAt: inserted?.created_at || null,
      summary: {
        bucket,
        eventId,
        isNominated,
      },
      eventId,
      eventName: requestedEventName || null,
      parsed: null,
    });
  } catch (e) {
    return json({ error: "Unexpected error", details: e?.message || String(e) }, 500);
  }
}
