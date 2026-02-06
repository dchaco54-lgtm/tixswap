// app/api/orders/[orderId]/renominated/route.js
import { NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import { rateLimitByRequest } from "@/lib/security/rateLimit";
import { logAuditEvent } from "@/lib/security/audit";
import { getRenominationStatus } from "@/lib/utils/renominationRules";

export const runtime = "nodejs";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) throw new Error("Missing env: NEXT_PUBLIC_SUPABASE_URL");
  if (!serviceKey) throw new Error("Missing env: SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

async function getAuthContext(req, orderId) {
  const supabase = getSupabaseAdmin();

  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) {
    return { error: NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 }) };
  }

  const { data: uData, error: uErr } = await supabase.auth.getUser(token);
  if (uErr || !uData?.user) {
    return { error: NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 }) };
  }

  const user = uData.user;
  const { data: order, error: oErr } = await supabase
    .from("orders")
    .select("id, seller_id, buyer_id, ticket_id, event_id, status, payment_state, paid_at, renominated_uploaded_at")
    .eq("id", orderId)
    .single();

  if (oErr || !order) {
    return { error: NextResponse.json({ error: "ORDER_NOT_FOUND" }, { status: 404 }) };
  }

  let event = null;
  let eventId = order.event_id || null;

  if (!eventId && order.ticket_id) {
    const { data: ticket } = await supabase
      .from("tickets")
      .select("id, event_id")
      .eq("id", order.ticket_id)
      .maybeSingle();
    eventId = ticket?.event_id || null;
  }

  if (eventId) {
    const { data: e, error: eErr } = await supabase
      .from("events")
      .select("id, starts_at, nomination_enabled_at, renomination_cutoff_hours, renomination_max_changes")
      .eq("id", eventId)
      .maybeSingle();
    if (eErr) {
      console.error("GET /api/orders/[orderId]/renominated eventErr", eErr);
    }
    event = e || null;
  }

  const { data: prof } = await supabase
    .from("profiles")
    .select("user_type")
    .eq("id", user.id)
    .maybeSingle();

  const isAdmin = prof?.user_type === "admin" || user.email === "soporte@tixswap.cl";
  const isSeller = order.seller_id === user.id;
  const isBuyer = order.buyer_id === user.id;

  if (!isAdmin && !isSeller && !isBuyer) {
    return { error: NextResponse.json({ error: "FORBIDDEN" }, { status: 403 }) };
  }

  return { supabase, user, order, event, isAdmin, isSeller, isBuyer };
}

async function persistRenominatedFile({ supabase, orderId, bucket, path }) {
  return supabase
    .from("orders")
    .update({
      renominated_storage_bucket: bucket,
      renominated_storage_path: path,
      renominated_uploaded_at: new Date().toISOString(),
    })
    .eq("id", orderId);
}

export async function POST(req, { params }) {
  try {
    const orderId = params?.orderId;
    if (!orderId) {
      return NextResponse.json({ error: "Missing orderId" }, { status: 400 });
    }

    const rate = rateLimitByRequest(req, {
      bucket: `renominated-upload:${orderId}`,
      limit: 8,
      windowMs: 10 * 60 * 1000,
    });

    if (!rate.ok) {
      return NextResponse.json(
        { error: "Demasiados intentos de subida. Intenta nuevamente en unos minutos." },
        { status: 429 }
      );
    }

    const ctx = await getAuthContext(req, orderId);
    if (ctx.error) return ctx.error;

    const { supabase, user, order, event, isAdmin } = ctx;

    const cutoffHours = event?.renomination_cutoff_hours ?? 36;
    const renoStatus = getRenominationStatus({
      now: new Date(),
      eventStartsAt: event?.starts_at,
      nominationEnabledAt: event?.nomination_enabled_at,
      cutoffHours,
      orderPaidAt: order?.paid_at,
      renominatedUploadedAt: order?.renominated_uploaded_at,
    });

    if (renoStatus.isEventStarted) {
      return NextResponse.json(
        { error: "El evento ya comenzo; contacta soporte." },
        { status: 400 }
      );
    }

    const warning = renoStatus.isPastHardCutoff
      ? `Estas intentando subir el PDF despues del cutoff recomendado (${cutoffHours}h antes del show).`
      : null;

    const paidOk =
      String(order?.status || "").toLowerCase() === "paid" ||
      String(order?.payment_state || "").toUpperCase() === "AUTHORIZED";

    if (!paidOk && !isAdmin) {
      return NextResponse.json(
        { error: "La orden aun no esta pagada." },
        { status: 400 }
      );
    }

    const form = await req.formData();
    const file = form.get("file");

    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "Falta el PDF renominado (file)." }, { status: 400 });
    }

    if (typeof file.size === "number" && file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        { error: "El PDF excede el tamaño permitido (10MB)." },
        { status: 413 }
      );
    }

    const buf = Buffer.from(await file.arrayBuffer());
    if (buf.slice(0, 4).toString() !== "%PDF") {
      return NextResponse.json({ error: "Debe ser un PDF válido." }, { status: 400 });
    }

    const bucket = process.env.TICKET_PDF_BUCKET ?? "ticket-pdfs";
    const path = `orders/${orderId}/renominated-${crypto.randomUUID()}.pdf`;

    const { error: upErr } = await supabase.storage.from(bucket).upload(path, buf, {
      contentType: "application/pdf",
      upsert: false,
    });

    if (upErr) {
      return NextResponse.json(
        { error: "Storage error", details: upErr.message },
        { status: 500 }
      );
    }

    const { error: updErr } = await persistRenominatedFile({
      supabase,
      orderId,
      bucket,
      path,
    });

    if (updErr) {
      return NextResponse.json({ error: "DB error", details: updErr.message }, { status: 500 });
    }

    await logAuditEvent({
      eventType: "RENOMINATION_UPLOADED",
      userId: user.id,
      orderId: order.id,
      metadata: { bucket, path, method: "direct-upload" },
    });

    return NextResponse.json({ ok: true, orderId, bucket, path, warning });
  } catch (e) {
    return NextResponse.json(
      { error: "Server error", details: e?.message || String(e) },
      { status: 500 }
    );
  }
}

export async function PATCH(req, { params }) {
  try {
    const orderId = params?.orderId;
    if (!orderId) {
      return NextResponse.json({ error: "Missing orderId" }, { status: 400 });
    }

    const rate = rateLimitByRequest(req, {
      bucket: `renominated-confirm:${orderId}`,
      limit: 20,
      windowMs: 10 * 60 * 1000,
    });

    if (!rate.ok) {
      return NextResponse.json(
        { error: "Demasiados intentos. Espera unos minutos para reintentar." },
        { status: 429 }
      );
    }

    const ctx = await getAuthContext(req, orderId);
    if (ctx.error) return ctx.error;

    const { supabase, user, order, event, isAdmin } = ctx;

    const cutoffHours = event?.renomination_cutoff_hours ?? 36;
    const renoStatus = getRenominationStatus({
      now: new Date(),
      eventStartsAt: event?.starts_at,
      nominationEnabledAt: event?.nomination_enabled_at,
      cutoffHours,
      orderPaidAt: order?.paid_at,
      renominatedUploadedAt: order?.renominated_uploaded_at,
    });

    if (renoStatus.isEventStarted) {
      return NextResponse.json(
        { error: "El evento ya comenzo; contacta soporte." },
        { status: 400 }
      );
    }

    const warning = renoStatus.isPastHardCutoff
      ? `Estas intentando subir el PDF despues del cutoff recomendado (${cutoffHours}h antes del show).`
      : null;

    const paidOk =
      String(order?.status || "").toLowerCase() === "paid" ||
      String(order?.payment_state || "").toUpperCase() === "AUTHORIZED";

    if (!paidOk && !isAdmin) {
      return NextResponse.json(
        { error: "La orden aun no esta pagada." },
        { status: 400 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const bucket = String(body?.bucket || "").trim();
    const path = String(body?.path || "").trim();

    if (!bucket || !path) {
      return NextResponse.json({ error: "bucket y path son requeridos." }, { status: 400 });
    }

    if (!path.startsWith(`orders/${orderId}/renominated-`)) {
      return NextResponse.json(
        { error: "Ruta inválida para este orderId." },
        { status: 400 }
      );
    }

    const { error: updErr } = await persistRenominatedFile({
      supabase,
      orderId,
      bucket,
      path,
    });

    if (updErr) {
      return NextResponse.json({ error: "DB error", details: updErr.message }, { status: 500 });
    }

    await logAuditEvent({
      eventType: "RENOMINATION_UPLOADED",
      userId: user.id,
      orderId: order.id,
      metadata: { bucket, path, method: "signed-upload" },
    });

    return NextResponse.json({ ok: true, orderId, bucket, path, warning });
  } catch (e) {
    return NextResponse.json(
      { error: "Server error", details: e?.message || String(e) },
      { status: 500 }
    );
  }
}
