// app/api/payments/banchile/confirm/route.js
import { NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sendEmail } from "@/lib/email/resend";
import { templateOrderPaidBuyer, templateOrderPaidSeller } from "@/lib/email/templates";

export const runtime = "nodejs";

const DEFAULT_TEST_BASE = "https://checkout.test.banchilepagos.cl";
const DEFAULT_PROD_BASE = "https://checkout.banchilepagos.cl";

function normalizeBaseUrl(raw) {
  const mode = (process.env.BANCHILE_MODE || "test").toLowerCase();
  const fallback = mode === "prod" ? DEFAULT_PROD_BASE : DEFAULT_TEST_BASE;

  if (!raw) return fallback;

  let v = String(raw).trim();
  if (v === "BANCHILE_BASE_URL") return fallback;

  v = v.replace(/\/api\/session\/?$/i, "");
  v = v.replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(v)) v = `https://${v}`;

  return v;
}

function generateAuth(login, secretKey) {
  const seed = new Date().toISOString();
  const nonceBytes = crypto.randomBytes(16);

  const tranKey = crypto
    .createHash("sha256")
    .update(Buffer.concat([nonceBytes, Buffer.from(seed), Buffer.from(secretKey)]))
    .digest("base64");

  const nonce = nonceBytes.toString("base64");

  return { login, tranKey, nonce, seed };
}

function mapPaymentState(state) {
  if (state === "APPROVED") return { payment_state: "paid", status: "paid" };
  if (state === "REJECTED") return { payment_state: "rejected", status: "rejected" };
  return { payment_state: "pending", status: "created" };
}

function normalizeSiteUrl(url) {
  if (!url) return "";
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

async function loadOrderEmailData(admin, order) {
  const ids = [order.buyer_id, order.seller_id].filter(Boolean);
  const profilesById = {};

  if (ids.length) {
    const { data: profiles } = await admin
      .from("profiles")
      .select("id, full_name, email")
      .in("id", ids);

    (profiles || []).forEach((p) => {
      profilesById[p.id] = p;
    });
  }

  let ticket = null;
  if (order.ticket_id) {
    const { data: t } = await admin
      .from("tickets")
      .select("id, event_id")
      .eq("id", order.ticket_id)
      .maybeSingle();
    ticket = t || null;
  }

  const eventId = order.event_id || ticket?.event_id || null;
  let eventName = null;
  if (eventId) {
    const { data: eventRow } = await admin
      .from("events")
      .select("title")
      .eq("id", eventId)
      .maybeSingle();
    eventName = eventRow?.title || null;
  }

  return {
    buyer: profilesById[order.buyer_id] || null,
    seller: profilesById[order.seller_id] || null,
    eventName,
  };
}

async function sendPaidEmails(admin, order, baseUrl) {
  try {
    const { buyer, seller, eventName } = await loadOrderEmailData(admin, order);

    if (buyer?.email) {
      const { subject, html } = templateOrderPaidBuyer({
        buyerName: buyer?.full_name || null,
        eventName,
        totalClp: order.total_clp ?? order.total_amount ?? null,
        orderId: order.id,
        link: `${baseUrl}/dashboard/purchases/${order.id}`,
      });

      const buyerRes = await sendEmail({ to: buyer.email, subject, html });
      if (!buyerRes.ok && !buyerRes.skipped) {
        console.warn("[Banchile Confirm] Buyer email error:", buyerRes.error);
      }
    }

    if (seller?.email) {
      const { subject, html } = templateOrderPaidSeller({
        sellerName: seller?.full_name || null,
        eventName,
        amountClp: order.amount_clp ?? order.amount ?? null,
        orderId: order.id,
        ticketId: order.ticket_id,
        link: `${baseUrl}/dashboard/publications/${order.ticket_id}`,
      });

      const sellerRes = await sendEmail({ to: seller.email, subject, html });
      if (!sellerRes.ok && !sellerRes.skipped) {
        console.warn("[Banchile Confirm] Seller email error:", sellerRes.error);
      }
    }
  } catch (err) {
    console.warn("[Banchile Confirm] Email error:", err);
  }
}

export async function POST(req) {
  try {
    const { orderId } = await req.json().catch(() => ({}));
    if (!orderId) return NextResponse.json({ error: "Falta orderId." }, { status: 400 });

    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

    const admin = supabaseAdmin();

    const { data: userRes } = await admin.auth.getUser(token);
    const userId = userRes?.user?.id;
    if (!userId) return NextResponse.json({ error: "No se pudo validar usuario." }, { status: 401 });

    const BANCHILE_LOGIN = process.env.BANCHILE_LOGIN;
    const BANCHILE_SECRET_KEY = process.env.BANCHILE_SECRET_KEY;
    const baseUrl = normalizeBaseUrl(process.env.BANCHILE_BASE_URL);

    if (!BANCHILE_LOGIN || !BANCHILE_SECRET_KEY) {
      return NextResponse.json(
        { error: "Faltan credenciales Banchile en el servidor." },
        { status: 500 }
      );
    }

    const { data: order, error: orderErr } = await admin
      .from("orders")
      .select("id, user_id, buyer_id, seller_id, ticket_id, event_id, payment_request_id, status, amount, amount_clp, total_amount, total_clp, fee_clp")
      .eq("id", orderId)
      .single();

    if (orderErr || !order) return NextResponse.json({ error: "Orden no encontrada." }, { status: 404 });
    if (order.user_id !== userId) return NextResponse.json({ error: "No autorizado para esta orden." }, { status: 403 });

    const requestId = order.payment_request_id;
    if (!requestId) return NextResponse.json({ error: "Orden sin requestId (payment_request_id)." }, { status: 400 });

    const auth = generateAuth(BANCHILE_LOGIN, BANCHILE_SECRET_KEY);

    const url = new URL(`/api/session/${requestId}`, baseUrl).toString();

    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ auth }),
      cache: "no-store",
    });

    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      return NextResponse.json(
        { error: j?.status?.message || j?.message || `Banchile error HTTP ${r.status}`, details: j },
        { status: 502 }
      );
    }

    // Dependiendo del formato exacto, tomamos el estado más “real”
    const candidateA = j?.status?.status;
    const candidateB = j?.request?.status?.status;

    const known = new Set(["APPROVED", "REJECTED", "PENDING", "APPROVED_PARTIAL", "PARTIAL_EXPIRED"]);
    const state = known.has(candidateA) ? candidateA : known.has(candidateB) ? candidateB : candidateA || candidateB || "PENDING";

    const upd = mapPaymentState(state);

    const alreadyPaid = order.status === "paid";
    const siteBaseUrl = normalizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin);

    // actualizar orden
    await admin
      .from("orders")
      .update({
        payment_state: upd.payment_state,
        status: upd.status,
        payment_payload: j, // si existe columna JSONB, bkn; si no existe, bórrala de aquí
      })
      .eq("id", orderId);

    // si aprobado -> marcar ticket sold
    if (state === "APPROVED" && order.ticket_id) {
      await admin
        .from("tickets")
        .update({ status: "sold" })
        .eq("id", order.ticket_id);
    }

    if (state === "APPROVED" && !alreadyPaid) {
      await sendPaidEmails(admin, order, siteBaseUrl);
    }

    return NextResponse.json({ state, details: j }, { status: 200 });
  } catch (e) {
    return NextResponse.json(
      { error: `Error interno — ${e?.message || "unknown"}` },
      { status: 500 }
    );
  }
}

