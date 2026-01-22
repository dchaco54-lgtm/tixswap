import { NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import pdfParse from "pdf-parse";
import { detectProviderAndParse, validateParsed } from "@/lib/ticket-parsers";

export const runtime = "nodejs";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) throw new Error("Missing env: NEXT_PUBLIC_SUPABASE_URL");
  if (!serviceKey) throw new Error("Missing env: SUPABASE_SERVICE_ROLE_KEY");

  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

async function columnExists(supabase, table, col) {
  const { error } = await supabase.from(table).select(col).limit(1);
  return !error;
}

async function detectHashColumn(supabase) {
  const table = "ticket_uploads";
  const candidates = ["file_hash", "sha256"];
  for (const col of candidates) {
    // eslint-disable-next-line no-await-in-loop
    if (await columnExists(supabase, table, col)) return col;
  }
  return "file_hash";
}

async function signViewUrl(supabase, bucket, path) {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60); // 1h
  if (error) return null;
  return data?.signedUrl || null;
}

export async function POST(req) {
  try {
    const supabase = getSupabaseAdmin();
    const formData = await req.formData();

    const file = formData.get("file");
    const sellerId = formData.get("sellerId") || null;
    const isNominada = (formData.get("isNominada") || "false") === "true";
    const qrPayload = formData.get("qr_payload") || "";

    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "Archivo inválido" }, { status: 400 });
    }

    const name = file.name || "ticket.pdf";
    if (!name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json({ error: "El archivo debe tener extensión .pdf" }, { status: 400 });
    }

    const maxBytes = 8 * 1024 * 1024; // 8MB
    if (file.size > maxBytes) {
      return NextResponse.json({ error: "Máx 8MB. El archivo es demasiado grande." }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const bytes = Buffer.from(arrayBuffer);

    const header = bytes.subarray(0, 4).toString("utf8");
    if (header !== "%PDF") {
      return NextResponse.json({ error: "El archivo no parece ser un PDF válido." }, { status: 400 });
    }

    // Extraer texto del PDF (para validar que no sea imagen escaneada)
    let parsedPdf;
    try {
      parsedPdf = await pdfParse(bytes);
    } catch (err) {
      return NextResponse.json({ error: "No pudimos leer tu ticket, sube el PDF original descargado del proveedor (no escaneado)." }, { status: 400 });
    }

    const text = String(parsedPdf?.text || "");
    if (text.replace(/\s+/g, " ").trim().length < 200) {
      return NextResponse.json({ error: "No pudimos leer tu ticket, sube el PDF original descargado del proveedor (no escaneado)." }, { status: 400 });
    }

    // Detectar provider y parsear
    const { provider, parsed } = detectProviderAndParse(text);
    console.log('[Backend] Provider detectado:', provider);
    console.log('[Backend] Datos parseados:', JSON.stringify(parsed, null, 2));
    
    if (!provider) {
      return NextResponse.json({ error: "Proveedor no soportado aún (por ahora solo PuntoTicket)." }, { status: 400 });
    }

    const validationErrors = validateParsed(provider, parsed);
    console.log('[Backend] Errores de validación:', validationErrors);
    
    if (validationErrors.length) {
      return NextResponse.json({ error: "No se pudo validar el PDF", details: validationErrors.join("; ") }, { status: 400 });
    }

    // Validar QR payload (MVP) - temporal: hacerlo opcional
    const qrStr = String(qrPayload || "");
    if (!qrStr || qrStr.length < 6) {
      console.warn('[Backend] ⚠️ QR vacío o muy corto, continuando de todas formas (modo debug)');
      // return NextResponse.json({ error: "No pudimos leer el QR. Sube el PDF original (descargado), sin capturas/escaneos." }, { status: 400 });
    } else if (parsed.ticket_number && !qrStr.includes(parsed.ticket_number)) {
      console.warn('[Backend] ⚠️ QR no contiene ticket_number, continuando de todas formas (modo debug)');
      // return NextResponse.json({ error: "PDF posiblemente alterado: el QR no coincide con los datos del ticket." }, { status: 400 });
    }

    // Dedupe principal por provider + ticket_number
    if (parsed.ticket_number) {
      const { data: dupe, error: dupeErr } = await supabase
        .from("ticket_uploads")
        .select("id, storage_bucket, storage_path")
        .eq("provider", provider)
        .eq("ticket_number", parsed.ticket_number)
        .maybeSingle();

      if (dupeErr) {
        return NextResponse.json({ error: "DB error (dedupe provider+ticket)", details: dupeErr.message }, { status: 500 });
      }

      if (dupe?.id) {
        const bucket = dupe.storage_bucket || "ticket-pdfs";
        const path = dupe.storage_path;
        const viewUrl = path ? await signViewUrl(supabase, bucket, path) : null;
        return NextResponse.json(
          {
            error: "DUPLICATE",
            message: "Este ticket ya fue subido antes.",
            existing: { id: dupe.id, filePath: path || null, viewUrl },
          },
          { status: 409 }
        );
      }
    }

    // Hash dedupe (adicional)
    const hash = crypto.createHash("sha256").update(bytes).digest("hex");
    const hashCol = await detectHashColumn(supabase);

    const { data: existing, error: findErr } = await supabase
      .from("ticket_uploads")
      .select(`id, storage_bucket, storage_path, ${hashCol}`)
      .eq(hashCol, hash)
      .maybeSingle();

    if (findErr) {
      return NextResponse.json({ error: "DB error (dedupe)", details: findErr.message }, { status: 500 });
    }

    if (existing?.id) {
      const bucket = existing.storage_bucket || "ticket-pdfs";
      const path = existing.storage_path;
      const viewUrl = path ? await signViewUrl(supabase, bucket, path) : null;
      return NextResponse.json(
        {
          error: "DUPLICATE",
          message: "Entrada ya subida en Tixswap",
          sha256: hash,
          existing: { id: existing.id, filePath: path || null, viewUrl },
        },
        { status: 409 }
      );
    }

    // Storage upload
    const bucket = "ticket-pdfs";
    const safeName = name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storagePath = `tickets/${hash}/${Date.now()}_${safeName}`;

    const { error: uploadErr } = await supabase.storage.from(bucket).upload(storagePath, bytes, {
      contentType: "application/pdf",
      upsert: false,
    });

    if (uploadErr) {
      return NextResponse.json({ error: "Storage upload error", details: uploadErr.message }, { status: 500 });
    }

    // Insert DB (solo columnas que existan)
    const insertPayload = {
      [hashCol]: hash,
      storage_bucket: bucket,
      storage_path: storagePath,
      original_name: name,
      mime_type: "application/pdf",
      file_size: bytes.length,
      status: "uploaded",
    };

    const toSet = {
      provider: provider,
      ticket_number: parsed.ticket_number,
      order_number: parsed.order_number,
      event_name: parsed.event_name,
      event_datetime: parsed.event_datetime_iso,
      venue: parsed.venue,
      sector: parsed.sector,
      category: parsed.category,
      attendee_name: parsed.attendee_name,
      attendee_rut: parsed.attendee_rut,
      producer_name: parsed.producer_name,
      producer_rut: parsed.producer_rut,
      qr_payload: qrStr,
      validation_status: "validated",
      validation_reason: null,
    };

    for (const [k, v] of Object.entries(toSet)) {
      // eslint-disable-next-line no-await-in-loop
      if (await columnExists(supabase, "ticket_uploads", k)) insertPayload[k] = v;
    }

    if (sellerId && (await columnExists(supabase, "ticket_uploads", "seller_id"))) {
      insertPayload.seller_id = sellerId;
    }
    if (await columnExists(supabase, "ticket_uploads", "is_nominada")) {
      insertPayload.is_nominada = isNominada;
    }

    const { data: inserted, error: insErr } = await supabase
      .from("ticket_uploads")
      .insert(insertPayload)
      .select("id, storage_bucket, storage_path, created_at")
      .single();

    if (insErr) {
      await supabase.storage.from(bucket).remove([storagePath]).catch(() => {});
      return NextResponse.json({ error: "DB insert error", details: insErr.message }, { status: 500 });
    }

    const viewUrl = await signViewUrl(supabase, bucket, storagePath);

    return NextResponse.json({
      ok: true,
      ticketUploadId: inserted.id,
      sha256: hash,
      filePath: inserted.storage_path,
      viewUrl,
      createdAt: inserted.created_at || null,
      isNominada,
      summary: {
        provider,
        ticket_number: parsed.ticket_number,
        order_number: parsed.order_number,
        event_name: parsed.event_name,
        event_datetime_iso: parsed.event_datetime_iso,
        venue: parsed.venue,
        sector: parsed.sector,
        category: parsed.category,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: "Server error", details: e?.message || String(e) }, { status: 500 });
  }
}
