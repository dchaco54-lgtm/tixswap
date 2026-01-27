// app/api/tickets/register/route.js
import { NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import pdfParse from "pdf-parse";
import { detectProviderAndParse, validateParsedTicket } from "@/lib/ticket-parsers";

export const runtime = "nodejs";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) throw new Error("Missing env: NEXT_PUBLIC_SUPABASE_URL");
  if (!serviceKey) throw new Error("Missing env: SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

async function columnExists(supabase, table, column) {
  const { data, error } = await supabase.rpc("column_exists", {
    tbl: table,
    col: column,
  });
  if (error) return false;
  return !!data;
}

export async function POST(req) {
  try {
    const supabase = getSupabaseAdmin();


    // Multipart
    const form = await req.formData();
    const file = form.get("file");
    const is_nominada = String(form.get("is_nominada") || "false") === "true";
    let sellerId = form.get("sellerId");

    // Auth: si no viene sellerId, derivarlo del token
    let user = null;
    if (!sellerId) {
      const authHeader = req.headers.get("authorization") || "";
      const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
      if (!token) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
      const { data: uData, error: uErr } = await supabase.auth.getUser(token);
      if (uErr || !uData?.user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
      user = uData.user;
      sellerId = user.id;
    } else {
      user = { id: sellerId };
    }

    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "Falta el archivo PDF." }, { status: 400 });
    }

    // Basic checks
    const filename = file.name || "ticket.pdf";
    const size = file.size || 0;
    if (size <= 0) return NextResponse.json({ error: "Archivo vacío." }, { status: 400 });
    if (size > 8 * 1024 * 1024) {
      return NextResponse.json({ error: "Máx 8MB." }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // PDF magic header
    if (buffer.slice(0, 4).toString() !== "%PDF") {
      return NextResponse.json({ error: "Debe ser un PDF válido." }, { status: 400 });
    }

    // Hash (anti-duplicado global)
    const file_hash = crypto.createHash("sha256").update(buffer).digest("hex");

    // Insert into ticket_files (if exists) for dedupe
    // (si tu proyecto usa esta tabla, perfecto; si no existe, lo salta)
    const hasTicketFiles = await columnExists(supabase, "ticket_files", "file_hash");
    if (hasTicketFiles) {
      const { data: existing } = await supabase
        .from("ticket_files")
        .select("id")
        .eq("file_hash", file_hash)
        .maybeSingle();

      if (existing?.id) {
        return NextResponse.json(
          { error: "Este PDF ya fue subido (anti-duplicado)." },
          { status: 409 }
        );
      }

      await supabase.from("ticket_files").insert({
        file_hash,
        original_name: filename,
        size_bytes: size,
        uploaded_by: user.id,
      });
    }


    // Bucket configurable para PDFs
    const BUCKET = process.env.TICKET_PDF_BUCKET ?? "ticket-pdfs";
    const bucket = BUCKET;
    const storage_path = `uploads/${user.id}/${crypto.randomUUID()}.pdf`;

    const { error: upErr } = await supabase.storage.from(bucket).upload(storage_path, buffer, {
      contentType: "application/pdf",
      upsert: false,
    });

    if (upErr) {
      return NextResponse.json({ error: "Storage error", details: upErr.message }, { status: 500 });
    }

    // Parse text
    let text = "";
    try {
      const parsedPdf = await pdfParse(buffer);
      text = (parsedPdf?.text || "").trim();
    } catch {
      text = "";
    }

    // Detect provider + parse
    let provider = null;
    let parsed = null;
    let manual_review = false;

    try {
      const out = detectProviderAndParse(text);
      provider = out?.provider || null;
      parsed = out?.parsed || null;
    } catch {
      provider = null;
      parsed = null;
    }

    // ✅ MVP: si no hay proveedor, NO bloquear => manual review
    if (!provider || !parsed) {
      manual_review = true;
      provider = "manual";
      parsed = {
        ticket_number: null,
        event_name: null,
        event_date: null,
        seat_info: null,
        buyer_name: null,
        buyer_rut: null,
        raw_text: text || null,
      };
    } else {
      // Validación del parse solo si detectó proveedor real
      const v = validateParsedTicket(parsed);
      if (!v.ok) {
        // igual lo guardamos (pero como manual), para que no se pierda
        manual_review = true;
        provider = provider || "manual";
      }
    }

    const nowIso = new Date().toISOString();
    const toSet = {
      user_id: user.id,
      provider,
      file_hash,
      storage_bucket: bucket,
      storage_path,
      is_nominada,
      ticket_number: parsed?.ticket_number || null,
      event_name: parsed?.event_name || null,
      event_date: parsed?.event_date || null,
      seat_info: parsed?.seat_info || null,
      buyer_name: parsed?.buyer_name || null,
      buyer_rut: parsed?.buyer_rut || null,
      raw_text: text || null,
      parsed_data: parsed || null,
      status: "uploaded",
      validation_status: manual_review ? "pending_manual" : "parsed_ok",
      updated_at: nowIso,
    };

    const { data: uploadRow, error: insErr } = await supabase
      .from("ticket_uploads")
      .insert(toSet)
      .select("id, provider, event_name, event_date, seat_info, ticket_number, validation_status")
      .single();

    if (insErr) {
      return NextResponse.json({ error: "DB error", details: insErr.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      upload_id: uploadRow.id,
      manual_review,
      upload_summary: uploadRow,
    });
  } catch (e) {
    return NextResponse.json({ error: "Server error", details: e?.message || String(e) }, { status: 500 });
  }
}

