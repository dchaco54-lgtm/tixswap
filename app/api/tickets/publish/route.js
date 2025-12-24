import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) throw new Error("Missing env: NEXT_PUBLIC_SUPABASE_URL");
  if (!serviceKey) throw new Error("Missing env: SUPABASE_SERVICE_ROLE_KEY");

  return createClient(url, serviceKey, {
    auth: { persistSession: false },
  });
}

async function columnExists(supabase, table, col) {
  const { error } = await supabase.from(table).select(col).limit(1);
  return !error;
}

function pickFirstDefined(obj, keys) {
  for (const k of keys) {
    if (obj && obj[k] !== undefined && obj[k] !== null) return obj[k];
  }
  return null;
}

export async function POST(req) {
  try {
    const supabase = getSupabaseAdmin();

    // ---------- AUTH ----------
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

    if (!token) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData?.user) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }
    const user = userData.user;

    // ---------- BODY ----------
    const body = await req.json().catch(() => ({}));

    const event_id = body?.event_id ?? null;
    const price = Number(body?.price);

    if (!event_id) {
      return NextResponse.json({ error: "Falta event_id" }, { status: 400 });
    }
    if (!Number.isFinite(price) || price <= 0) {
      return NextResponse.json({ error: "Precio inválido" }, { status: 400 });
    }

    const table = "tickets";

    // ---------- INSERT PAYLOAD BASE ----------
    const insertPayload = {
      event_id,
      price,
    };

    // ---------- SELLER IDENTIDAD (lo importante) ----------
    // Guardar seller_id SI existe la columna
    const hasSellerId = await columnExists(supabase, table, "seller_id");
    if (hasSellerId) insertPayload.seller_id = user.id;

    // Guardar seller_rut SI existe la columna y lo tenemos en profiles
    const hasSellerRut = await columnExists(supabase, table, "seller_rut");
    if (hasSellerRut) {
      const { data: prof, error: profErr } = await supabase
        .from("profiles")
        .select("rut")
        .eq("id", user.id)
        .maybeSingle();

      // si no existe rut o falla, no reviento el publish: simplemente no lo seteo
      if (!profErr && prof?.rut) insertPayload.seller_rut = prof.rut;
    }

    // seller_name (opcional)
    const hasSellerName = await columnExists(supabase, table, "seller_name");
    if (hasSellerName) {
      const sellerName =
        pickFirstDefined(user.user_metadata, ["name", "full_name", "nombre"]) || user.email || null;
      if (sellerName) insertPayload.seller_name = sellerName;
    }

    // ---------- CAMPOS DEL PASO 1 (solo si existen columnas) ----------
    const description = body?.description ?? null;
    if (description && (await columnExists(supabase, table, "description"))) {
      insertPayload.description = description;
    }

    const sector = body?.sector ?? null;
    if (sector && (await columnExists(supabase, table, "sector"))) {
      insertPayload.sector = sector;
    }

    const rowValue = body?.fila ?? body?.row ?? null;
    if (rowValue) {
      if (await columnExists(supabase, table, "row")) insertPayload.row = rowValue;
      else if (await columnExists(supabase, table, "fila")) insertPayload.fila = rowValue;
    }

    const seatValue = body?.asiento ?? body?.seat ?? null;
    if (seatValue) {
      if (await columnExists(supabase, table, "seat")) insertPayload.seat = seatValue;
      else if (await columnExists(supabase, table, "asiento")) insertPayload.asiento = seatValue;
    }

    // original price (opcional)
    const originalPrice = body?.originalPrice;
    const originalNumber =
      originalPrice === null || originalPrice === undefined ? null : Number(originalPrice);

    if (Number.isFinite(originalNumber)) {
      if (await columnExists(supabase, table, "original_price")) insertPayload.original_price = originalNumber;
      else if (await columnExists(supabase, table, "originalPrice")) insertPayload.originalPrice = originalNumber;
      else if (await columnExists(supabase, table, "price_original")) insertPayload.price_original = originalNumber;
    }

    // sale type (por ahora fixed)
    const saleType = body?.saleType || "fixed";
    if (await columnExists(supabase, table, "sale_type")) insertPayload.sale_type = saleType;
    else if (await columnExists(supabase, table, "saleType")) insertPayload.saleType = saleType;

    // status (opcional)
    if (await columnExists(supabase, table, "status")) insertPayload.status = "active";

    // title default (si existe)
    if (await columnExists(supabase, table, "title")) insertPayload.title = "Entrada";

    // ---------- LINK PDF (paso 2) BEST-EFFORT ----------
    const tu = body?.ticketUpload || {};
    const ticketUploadId = tu?.ticketUploadId ?? tu?.id ?? null;
    const storagePath = tu?.filePath ?? tu?.storagePath ?? null;
    const fileHash = tu?.sha256 ?? tu?.fileHash ?? null;

    if (ticketUploadId) {
      if (await columnExists(supabase, table, "ticket_upload_id")) insertPayload.ticket_upload_id = ticketUploadId;
      else if (await columnExists(supabase, table, "ticket_uploads_id")) insertPayload.ticket_uploads_id = ticketUploadId;
      else if (await columnExists(supabase, table, "upload_id")) insertPayload.upload_id = ticketUploadId;
    }

    if (storagePath) {
      if (await columnExists(supabase, table, "ticket_pdf_path")) insertPayload.ticket_pdf_path = storagePath;
      else if (await columnExists(supabase, table, "storage_path")) insertPayload.storage_path = storagePath;
      else if (await columnExists(supabase, table, "pdf_path")) insertPayload.pdf_path = storagePath;
    }

    if (fileHash) {
      if (await columnExists(supabase, table, "file_hash")) insertPayload.file_hash = fileHash;
      else if (await columnExists(supabase, table, "sha256")) insertPayload.sha256 = fileHash;
      else if (await columnExists(supabase, table, "pdf_hash")) insertPayload.pdf_hash = fileHash;
    }

    const isNominada = !!tu?.isNominada || !!tu?.isNominated;
    if (await columnExists(supabase, table, "is_nominada")) insertPayload.is_nominada = isNominada;
    else if (await columnExists(supabase, table, "isNominada")) insertPayload.isNominada = isNominada;

    // ---------- INSERT ----------
    const { data: inserted, error: insErr } = await supabase
      .from(table)
      .insert(insertPayload)
      .select("id, event_id, seller_id, seller_rut")
      .single();

    if (insErr) {
      return NextResponse.json(
        { error: "DB insert error", details: insErr.message, payload_keys: Object.keys(insertPayload) },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      ticket_id: inserted.id,
      event_id: inserted.event_id,
      seller_id: inserted.seller_id ?? null,
      seller_rut: inserted.seller_rut ?? null,
    });
  } catch (e) {
    return NextResponse.json(
      { error: "Server error", details: e?.message || String(e) },
      { status: 500 }
    );
  }
}

