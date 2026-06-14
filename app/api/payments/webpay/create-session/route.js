import { NextResponse } from "next/server";
import crypto from "crypto";

import { isProfileReadyForSensitiveActions } from "@/lib/profileCompletion";
import {
  buildProfileIncompleteResponse,
  syncProfileFromAuthUser,
} from "@/lib/profileCompletionServer";
import { calculateWebpayOrderAmounts } from "@/lib/payments/webpayAmounts";
import {
  WEBPAY_ORDER_STATUS,
  WEBPAY_PAYMENT_STATE,
} from "@/lib/payments/webpayCallback";
import { logAuditEvent, AUDIT_EVENTS } from "@/lib/security/audit";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getWebpayTransaction } from "@/lib/webpay";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function makeBuyOrder() {
  const ts = Date.now().toString(36);
  const rnd = Math.floor(Math.random() * 1e6).toString(36);
  return (`TS${ts}${rnd}`).toUpperCase().slice(0, 26);
}

function makeSessionId() {
  const raw = crypto.randomUUID().replace(/-/g, "");
  return `S${raw.slice(0, 20)}`;
}

function normalizeBaseUrl(url) {
  if (!url) return "";
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

async function getUserViaSupabaseRest(accessToken) {
  try {
    const supabaseUrl =
      process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const apiKey =
      process.env.SUPABASE_ANON_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !apiKey || !accessToken) return null;

    const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        apikey: apiKey,
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    });

    if (!res.ok) return null;
    const user = await res.json().catch(() => null);
    return user && user.id ? user : null;
  } catch {
    return null;
  }
}

async function releaseHeldTicket(admin, ticketId) {
  if (!ticketId) return;
  const { error } = await admin
    .from("tickets")
    .update({ status: "active" })
    .eq("id", ticketId)
    .eq("status", "held");

  if (error) {
    console.error("[Webpay] No se pudo liberar ticket retenido", {
      ticketId,
      error: error.message,
    });
  }
}

async function resolveAuthenticatedUser(admin, accessToken) {
  if (!accessToken) return null;

  if (admin?.auth?.getUser) {
    const { data, error } = await admin.auth.getUser(accessToken);
    if (!error && data?.user) return data.user;
  }

  return getUserViaSupabaseRest(accessToken);
}

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const ticketId = String(body?.ticketId || "").trim();

    if (!ticketId) {
      return NextResponse.json({ error: "ticketId requerido" }, { status: 400 });
    }

    const admin = supabaseAdmin();
    const authHeader = req.headers.get("authorization") || "";
    const accessToken = authHeader.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length).trim()
      : null;

    if (!accessToken) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const user = await resolveAuthenticatedUser(admin, accessToken);
    if (!user?.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const buyerProfile = await syncProfileFromAuthUser(admin, user);
    if (!isProfileReadyForSensitiveActions(buyerProfile)) {
      return NextResponse.json(
        buildProfileIncompleteResponse(buyerProfile, "buy"),
        { status: 403 }
      );
    }

    const { data: ticket, error: ticketError } = await admin
      .from("tickets")
      .select("id, status, price, seller_id, event_id")
      .eq("id", ticketId)
      .single();

    if (ticketError || !ticket) {
      return NextResponse.json({ error: "Ticket no encontrado" }, { status: 404 });
    }

    if (String(ticket.status || "").toLowerCase() !== "active") {
      return NextResponse.json({ error: "Ticket no disponible" }, { status: 409 });
    }

    if (ticket.seller_id === user.id) {
      return NextResponse.json(
        { error: "No puedes comprar tu propio ticket" },
        { status: 400 }
      );
    }

    const { data: sellerProfile, error: sellerError } = await admin
      .from("profiles")
      .select("seller_tier")
      .eq("id", ticket.seller_id)
      .maybeSingle();

    if (sellerError) {
      console.error("[Webpay] Error consultando seller_tier", {
        ticketId,
        sellerId: ticket.seller_id,
        error: sellerError.message,
      });
      return NextResponse.json(
        { error: "No pudimos preparar el pago" },
        { status: 500 }
      );
    }

    let orderAmounts;
    try {
      orderAmounts = calculateWebpayOrderAmounts({
        ticketPrice: ticket.price,
        sellerTier: sellerProfile?.seller_tier,
      });
    } catch (error) {
      return NextResponse.json(
        { error: error.message || "Monto invalido para Webpay" },
        { status: 400 }
      );
    }

    const buyOrder = makeBuyOrder();
    const sessionId = makeSessionId();

    const { data: heldRows, error: holdError } = await admin
      .from("tickets")
      .update({ status: "held" })
      .eq("id", ticketId)
      .eq("status", "active")
      .select("id");

    if (holdError || !heldRows?.length) {
      return NextResponse.json(
        { error: "No se pudo reservar el ticket (puede que ya lo hayan tomado)" },
        { status: 409 }
      );
    }

    const orderInsert = {
      ticket_id: ticketId,
      event_id: ticket.event_id || null,
      user_id: user.id,
      buyer_id: user.id,
      seller_id: ticket.seller_id,
      buy_order: buyOrder,
      session_id: sessionId,
      amount: orderAmounts.ticketAmountClp,
      amount_clp: orderAmounts.ticketAmountClp,
      fee_clp: orderAmounts.feeAmountClp,
      total_amount: orderAmounts.totalAmountClp,
      total_clp: orderAmounts.totalAmountClp,
      payment_state: WEBPAY_PAYMENT_STATE.PENDING,
      status: WEBPAY_ORDER_STATUS.PENDING,
      payment_provider: "webpay",
      payment_method: "webpay",
      currency: "CLP",
    };

    const { data: order, error: orderError } = await admin
      .from("orders")
      .insert(orderInsert)
      .select("id, buy_order, session_id")
      .single();

    if (orderError || !order?.id) {
      await releaseHeldTicket(admin, ticketId);
      return NextResponse.json(
        { error: "No se pudo crear la orden" },
        { status: 500 }
      );
    }

    const baseUrl = normalizeBaseUrl(
      process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin
    );
    const returnUrl = `${baseUrl}/api/payments/webpay/return`;

    let webpaySession;
    try {
      const transaction = getWebpayTransaction();
      webpaySession = await transaction.create(
        buyOrder,
        sessionId,
        orderAmounts.totalAmountClp,
        returnUrl
      );
    } catch (error) {
      await releaseHeldTicket(admin, ticketId);
      await admin
        .from("orders")
        .update({
          status: WEBPAY_ORDER_STATUS.FAILED,
          payment_state: WEBPAY_PAYMENT_STATE.FAILED,
        })
        .eq("id", order.id);

      return NextResponse.json(
        { error: "No pudimos iniciar la transaccion con Webpay" },
        { status: 502 }
      );
    }

    const { error: persistError } = await admin
      .from("orders")
      .update({
        webpay_token: webpaySession.token,
        payment_process_url: webpaySession.url,
        payment_state: WEBPAY_PAYMENT_STATE.SESSION_CREATED,
      })
      .eq("id", order.id);

    if (persistError) {
      await releaseHeldTicket(admin, ticketId);
      await admin
        .from("orders")
        .update({
          status: WEBPAY_ORDER_STATUS.FAILED,
          payment_state: WEBPAY_PAYMENT_STATE.FAILED,
        })
        .eq("id", order.id);

      console.error("[Webpay] No se pudo persistir la sesion creada", {
        orderId: order.id,
        ticketId,
        error: persistError.message,
      });

      return NextResponse.json(
        { error: "No pudimos preparar el pago" },
        { status: 500 }
      );
    }

    await logAuditEvent({
      eventType: AUDIT_EVENTS.PAYMENT_INITIATED,
      userId: user.id,
      orderId: order.id,
      metadata: {
        provider: "webpay",
        ticket_id: ticketId,
        amount_clp: orderAmounts.ticketAmountClp,
        fee_clp: orderAmounts.feeAmountClp,
        total_clp: orderAmounts.totalAmountClp,
      },
    });

    return NextResponse.json(
      { token: webpaySession.token, url: webpaySession.url },
      { status: 200 }
    );
  } catch (error) {
    console.error("[Webpay] Error en create-session", {
      error: error?.message || "unknown_error",
    });
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
