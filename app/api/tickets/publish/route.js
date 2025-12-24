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

    // AUTH
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

    // BODY
    const body = await req.json().catch(() => ({}));
    const event_id = body?.event_id ?? null;
    const price = Number(body?.price);

    if (!event_id) return NextResponse.json({ error: "Falta event_id" }, { status: 400 });
    if (!Number.isFinite(price) || price <= 0) {
      return NextResponse.json({ error: "Precio inválido" }, { status: 400 });
    }

    const table = "tickets";

    // payload base
    const insertPayload = { event_id, price };

    // seller_id + seller_rut
    if (await columnExists(supabase, table, "seller_id")) {
      insertPayload.seller_id = user.id;
    }

    if (await columnExists(supabase, table, "seller_rut")) {
      const { data: prof, error: profErr } = await supabase
        .from("profiles")
        .select("rut")
        .eq("id", user.id)
        .maybeSingle();

      if (!profErr && prof?.rut) insertPayload.seller_rut = prof.rut;
    }

    // seller_name (opcional)
    if (await columnExists(supabase, table, "seller_name")) {
      const sellerName =
        pickFirstDefined(user.user_metadata, ["name", "full_name", "nombre"]) || user.email || null;
      if (sellerName) insertPayload.seller_name = sellerName;
    }

    // paso 1 (opcionales)
    const description = body?.description ?? null;
    if (description && (await columnExists(supabase, table, "description"))) insertPayload.description = description;

    const sector = body?.sector ?? null;
    if (sector && (await columnExists(supabase, table, "sector"))) insertPayload.sector = sector;

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

    // original price
    const originalPrice = body?.originalPrice;
    const originalNumber =
      originalPrice === null || originalPrice === undefined ? null : Number(originalPrice);

    if (Number.isFinite(originalNumber)) {
      if (await columnExists(supabase, table, "original_price")) insertPayload.original_price = originalNumber;
      else if (await columnExists(supabase, table, "price_original")) insertPayload.price_original = originalNumber;
    }

    // sale type
    const saleType = body?.saleType || "fixed";
    if (await columnExists(supabase, table, "sale_type")) insertPayload.sale_type = saleType;

    // status/title si existen
    if (await columnExists(supabase, table, "status")) insertPayload.status = "active";
    if (await columnExists(supabase, table, "title")) insertPayload.title = "Entrada";

    // pdf link (best-effort)
    const tu = body?.ticketUpload || {};
    const ticketUploadId = tu?.ticketUploadId ?? tu?.id ?? null;
    const storagePath = tu?.filePath ?? tu?.storagePath ?? null;
    const fileHash = tu?.sha256 ?? tu?.fileHash ?? null;

    if (ticketUploadId && (await columnExists(supabase, table, "ticket_upload_id"))) {
      insertPayload.ticket_upload_id = ticketUploadId;
    }
    if (storagePath && (await columnExists(supabase, table, "ticket_pdf_path"))) {
      insertPayload.ticket_pdf_path = storagePath;
    }
    if (fileHash && (await columnExists(supabase, table, "file_hash"))) {
      insertPayload.file_hash = fileHash;
    }

    // INSERT
    const { data: inserted, error: insErr } = await supabase
      .from(table)
      .insert(insertPayload)
      .select("id, event_id, seller_id, seller_rut")
      .single();

    if (insErr) {
      return NextResponse.json({ error: "DB insert error", details: insErr.message }, { status: 500 });
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
