import { NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import { rateLimitByRequest } from "@/lib/security/rateLimit";
import { logAuditEvent } from "@/lib/security/audit";

export const runtime = "nodejs";

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
    .select(
      "id, seller_id, buyer_id, status, payment_state, renominated_storage_bucket, renominated_storage_path"
    )
    .eq("id", orderId)
    .single();

  if (oErr || !order) {
    return { error: NextResponse.json({ error: "ORDER_NOT_FOUND" }, { status: 404 }) };
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

  return { supabase, user, order, isAdmin, isSeller, isBuyer };
}

export async function GET(req, { params }) {
  try {
    const orderId = params?.orderId;
    if (!orderId) {
      return NextResponse.json({ error: "Missing orderId" }, { status: 400 });
    }

    const rate = rateLimitByRequest(req, {
      bucket: `renominated-signed-read:${orderId}`,
      limit: 30,
      windowMs: 10 * 60 * 1000,
    });

    if (!rate.ok) {
      return NextResponse.json(
        { error: "Demasiadas solicitudes. Intenta nuevamente en unos minutos." },
        { status: 429 }
      );
    }

    const ctx = await getAuthContext(req, orderId);
    if (ctx.error) return ctx.error;

    const { supabase, user, order, isAdmin } = ctx;

    const paidOk =
      String(order?.status || "").toLowerCase() === "paid" ||
      String(order?.payment_state || "").toUpperCase() === "AUTHORIZED";

    if (!paidOk && !isAdmin) {
      return NextResponse.json(
        { error: "La orden aun no esta pagada." },
        { status: 400 }
      );
    }

    const bucket = order.renominated_storage_bucket || process.env.TICKET_PDF_BUCKET || "ticket-pdfs";
    const path = order.renominated_storage_path;

    if (!path) {
      return NextResponse.json(
        { error: "RENOMINATION_PENDING", message: "Aun no hay archivo renominado para esta orden." },
        { status: 404 }
      );
    }

    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 10 * 60);
    if (error || !data?.signedUrl) {
      return NextResponse.json(
        { error: "SIGNED_URL_ERROR", details: error?.message || "No se pudo firmar la URL." },
        { status: 500 }
      );
    }

    await logAuditEvent({
      eventType: "RENOMINATION_VIEWED",
      userId: user.id,
      orderId: order.id,
      metadata: { bucket, path },
    });

    return NextResponse.json({ ok: true, bucket, path, url: data.signedUrl });
  } catch (e) {
    return NextResponse.json(
      { error: "Server error", details: e?.message || String(e) },
      { status: 500 }
    );
  }
}

export async function POST(req, { params }) {
  try {
    const orderId = params?.orderId;
    if (!orderId) {
      return NextResponse.json({ error: "Missing orderId" }, { status: 400 });
    }

    const rate = rateLimitByRequest(req, {
      bucket: `renominated-signed-write:${orderId}`,
      limit: 12,
      windowMs: 10 * 60 * 1000,
    });

    if (!rate.ok) {
      return NextResponse.json(
        { error: "Demasiadas solicitudes. Espera unos minutos para reintentar." },
        { status: 429 }
      );
    }

    const ctx = await getAuthContext(req, orderId);
    if (ctx.error) return ctx.error;

    const { supabase, user, order, isAdmin } = ctx;

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
    const fileName = String(body?.fileName || "renominated.pdf").trim().toLowerCase();

    if (!fileName.endsWith(".pdf")) {
      return NextResponse.json({ error: "Solo se permiten archivos PDF." }, { status: 400 });
    }

    const bucket = process.env.TICKET_PDF_BUCKET || "ticket-pdfs";
    const path = `orders/${orderId}/renominated-${crypto.randomUUID()}.pdf`;

    const { data, error } = await supabase.storage.from(bucket).createSignedUploadUrl(path);
    if (error || !data?.signedUrl) {
      return NextResponse.json(
        { error: "SIGNED_UPLOAD_ERROR", details: error?.message || "No se pudo crear la URL firmada." },
        { status: 500 }
      );
    }

    await logAuditEvent({
      eventType: "TICKET_FILE_SHARED",
      userId: user.id,
      orderId: order.id,
      metadata: { bucket, path, action: "signed-upload-issued" },
    });

    return NextResponse.json({
      ok: true,
      bucket,
      path,
      token: data.token,
      signedUrl: data.signedUrl,
    });
  } catch (e) {
    return NextResponse.json(
      { error: "Server error", details: e?.message || String(e) },
      { status: 500 }
    );
  }
}
