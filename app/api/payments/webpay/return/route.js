import { NextResponse } from "next/server";

import { sendEmail } from "@/lib/email/resend";
import {
  templateOrderPaidBuyer,
  templateOrderPaidSeller,
} from "@/lib/email/templates";
import { createNotification } from "@/lib/notifications";
import {
  buildSafeWebpayPayload,
  maskTokenForLog,
  processWebpayCallback,
  WEBPAY_ORDER_STATUS,
  WEBPAY_PAYMENT_STATE,
} from "@/lib/payments/webpayCallback";
import { logAuditEvent, AUDIT_EVENTS } from "@/lib/security/audit";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getWebpayTransaction } from "@/lib/webpay";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function normalizeBaseUrl(url) {
  if (!url) return "";
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

function redirectToPayment(baseUrl, payment, orderId = null) {
  if (payment === "success" && orderId) {
    return NextResponse.redirect(
      `${baseUrl}/dashboard/purchases/${orderId}?payment=success`,
      { status: 303 }
    );
  }

  const qs = new URLSearchParams();
  qs.set("payment", payment || "unknown");
  if (orderId) qs.set("order", orderId);
  return NextResponse.redirect(`${baseUrl}/dashboard/purchases?${qs.toString()}`, {
    status: 303,
  });
}

function getReturnBaseUrl(req) {
  return normalizeBaseUrl(process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin);
}

function getPostString(formData, key) {
  const value = formData.get(key);
  return String(value || "").trim() || null;
}

function getQueryString(searchParams, key) {
  return String(searchParams.get(key) || "").trim() || null;
}

async function loadOrderEmailData(admin, order) {
  const ids = [order?.buyer_id, order?.seller_id].filter(Boolean);
  const profileMap = {};

  if (ids.length) {
    const { data: profiles, error } = await admin
      .from("profiles")
      .select("id, full_name, email")
      .in("id", ids);

    if (error) throw error;

    for (const profile of profiles || []) {
      profileMap[profile.id] = profile;
    }
  }

  let ticket = null;
  if (order?.ticket_id) {
    const { data, error } = await admin
      .from("tickets")
      .select("id, event_id")
      .eq("id", order.ticket_id)
      .maybeSingle();

    if (error) throw error;
    ticket = data || null;
  }

  const eventId = order?.event_id || ticket?.event_id || null;
  let eventName = null;
  if (eventId) {
    const { data: eventRow, error } = await admin
      .from("events")
      .select("title")
      .eq("id", eventId)
      .maybeSingle();

    if (error) throw error;
    eventName = eventRow?.title || null;
  }

  return {
    buyer: profileMap[order?.buyer_id] || null,
    seller: profileMap[order?.seller_id] || null,
    eventName,
  };
}

async function sendSuccessEffects(admin, order, ticket, expectedAmountClp, baseUrl) {
  try {
    const { buyer, seller, eventName } = await loadOrderEmailData(admin, order);

    if (order?.buyer_id) {
      await createNotification({
        userId: order.buyer_id,
        type: "buy",
        title: "Compra confirmada",
        body: eventName
          ? `Tu compra para ${eventName} fue confirmada.`
          : "Tu compra fue confirmada.",
        link: `/dashboard/purchases/${order.id}`,
        metadata: { orderId: order.id, ticketId: ticket?.id || null },
      });
    }

    if (order?.seller_id) {
      await createNotification({
        userId: order.seller_id,
        type: "sale",
        title: "Venta confirmada",
        body: eventName
          ? `Vendiste una entrada para ${eventName}.`
          : "Vendiste una entrada.",
        link: ticket?.id
          ? `/dashboard/publications/${ticket.id}`
          : "/dashboard/publicaciones",
        metadata: { orderId: order.id, ticketId: ticket?.id || null },
      });
    }

    if (buyer?.email) {
      const { subject, html } = templateOrderPaidBuyer({
        buyerName: buyer.full_name || null,
        eventName,
        totalClp: expectedAmountClp,
        orderId: order.id,
        link: `${baseUrl}/dashboard/purchases/${order.id}`,
      });

      const buyerResult = await sendEmail({ to: buyer.email, subject, html });
      if (!buyerResult.ok && !buyerResult.skipped) {
        console.warn("[Webpay Return] Buyer email error", {
          orderId: order.id,
          error: buyerResult.error,
        });
      }
    }

    if (seller?.email) {
      const { subject, html } = templateOrderPaidSeller({
        sellerName: seller.full_name || null,
        eventName,
        amountClp: order.amount_clp ?? order.amount ?? null,
        orderId: order.id,
        ticketId: ticket?.id || order.ticket_id || null,
        link: `${baseUrl}/dashboard/publications/${ticket?.id || order.ticket_id}`,
      });

      const sellerResult = await sendEmail({ to: seller.email, subject, html });
      if (!sellerResult.ok && !sellerResult.skipped) {
        console.warn("[Webpay Return] Seller email error", {
          orderId: order.id,
          error: sellerResult.error,
        });
      }
    }
  } catch (error) {
    console.warn("[Webpay Return] Success effects skipped", {
      orderId: order?.id || null,
      error: error?.message || "unknown_error",
    });
  }
}

async function updateOrderState(admin, orderId, patch) {
  const nextPatch = { ...patch, updated_at: new Date().toISOString() };
  const { error } = await admin.from("orders").update(nextPatch).eq("id", orderId);
  if (error) throw error;
}

async function releaseTicket(admin, ticketId) {
  const { error } = await admin
    .from("tickets")
    .update({ status: "active" })
    .eq("id", ticketId)
    .eq("status", "held");

  if (error) throw error;
}

async function markOrderForReview(admin, orderId, paymentPayload) {
  if (!orderId) return;

  try {
    await updateOrderState(admin, orderId, {
      status: WEBPAY_ORDER_STATUS.PAYMENT_REVIEW,
      payment_state: WEBPAY_PAYMENT_STATE.PAYMENT_REVIEW,
      payment_payload: buildSafeWebpayPayload(paymentPayload),
    });
  } catch (error) {
    console.error("[Webpay Return] No se pudo marcar orden en revision", {
      orderId,
      error: error.message,
    });
  }
}

async function handleCancellation({
  admin,
  baseUrl,
  source,
  buyOrder,
  sessionId,
}) {
  if (!buyOrder) {
    return redirectToPayment(baseUrl, "canceled");
  }

  const { data: order, error } = await admin
    .from("orders")
    .select(
      "id, ticket_id, buyer_id, status, session_id, buy_order, amount_clp, total_clp, total_amount"
    )
    .eq("buy_order", buyOrder)
    .maybeSingle();

  if (error) {
    console.error("[Webpay Return] Error buscando orden cancelada", {
      buyOrder,
      error: error.message,
    });
    return redirectToPayment(baseUrl, "error");
  }

  if (!order?.id) {
    return redirectToPayment(baseUrl, "canceled");
  }

  const persistedSessionId = String(order.session_id || "").trim() || null;
  if (persistedSessionId && sessionId && persistedSessionId !== sessionId) {
    await markOrderForReview(admin, order.id, {
      buy_order: buyOrder,
      session_id: sessionId,
      status: WEBPAY_PAYMENT_STATE.CANCELED,
      response_code: null,
    });

    await logAuditEvent({
      eventType: AUDIT_EVENTS.PAYMENT_REVIEW_REQUIRED,
      userId: order.buyer_id || null,
      orderId: order.id,
      metadata: {
        provider: "webpay",
        reason: "cancel_session_mismatch",
        source,
        buy_order: buyOrder,
      },
    });

    return redirectToPayment(baseUrl, "review", order.id);
  }

  if (String(order.status || "").toLowerCase() === WEBPAY_ORDER_STATUS.PAID) {
    return redirectToPayment(baseUrl, "success", order.id);
  }

  await updateOrderState(admin, order.id, {
    status: WEBPAY_ORDER_STATUS.CANCELED,
    payment_state: WEBPAY_PAYMENT_STATE.CANCELED,
    payment_payload: {
      buy_order: buyOrder,
      session_id: sessionId,
      status: WEBPAY_PAYMENT_STATE.CANCELED,
      source,
      canceled_at: new Date().toISOString(),
    },
  });

  if (order.ticket_id) {
    await releaseTicket(admin, order.ticket_id);
  }

  await logAuditEvent({
    eventType: AUDIT_EVENTS.PAYMENT_CANCELED,
    userId: order.buyer_id || null,
    orderId: order.id,
    metadata: {
      provider: "webpay",
      buy_order: buyOrder,
      source,
    },
  });

  return redirectToPayment(baseUrl, "canceled", order.id);
}

async function handleCallback({ req, source, token, buyOrder, sessionId }) {
  const admin = supabaseAdmin();
  const baseUrl = getReturnBaseUrl(req);

  if (!token && buyOrder) {
    return handleCancellation({
      admin,
      baseUrl,
      source,
      buyOrder,
      sessionId,
    });
  }

  if (!token) {
    return redirectToPayment(baseUrl, "unknown");
  }

  try {
    const callbackResult = await processWebpayCallback({
      token,
      source,
      logger: console,
      commitTransaction: async (tokenValue) => {
        const transaction = getWebpayTransaction();
        return transaction.commit(tokenValue);
      },
      loadOrderByBuyOrder: async (buyOrderValue) => {
        const { data, error } = await admin
          .from("orders")
          .select(
            "id, ticket_id, status, buyer_id, seller_id, event_id, amount, amount_clp, total_amount, total_clp, total_paid_clp, fee_clp, currency, session_id, buy_order, payment_state, webpay_token, webpay_authorization_code"
          )
          .eq("buy_order", buyOrderValue)
          .maybeSingle();

        if (error) throw error;
        return data || null;
      },
      loadTicketById: async (ticketId) => {
        const { data, error } = await admin
          .from("tickets")
          .select("id, event_id, status, seller_id")
          .eq("id", ticketId)
          .maybeSingle();

        if (error) throw error;
        return data || null;
      },
      updateOrderState: async (orderId, patch) => {
        await updateOrderState(admin, orderId, patch);
      },
      releaseTicket: async (ticketId) => {
        await releaseTicket(admin, ticketId);
      },
      settleApprovedPayment: async ({
        order,
        ticket,
        result,
        expectedAmountClp,
        token: webpayToken,
      }) => {
        const paidAt = result?.transaction_date
          ? new Date(result.transaction_date).toISOString()
          : new Date().toISOString();

        const payload = buildSafeWebpayPayload(result);
        const { data, error } = await admin.rpc("settle_webpay_order_payment", {
          p_order_id: order.id,
          p_ticket_id: ticket.id,
          p_buy_order: result?.buy_order || order.buy_order,
          p_session_id: order.session_id || null,
          p_paid_at: paidAt,
          p_total_paid_clp: expectedAmountClp,
          p_webpay_token: webpayToken,
          p_authorization_code: result?.authorization_code || null,
          p_payment_type_code: result?.payment_type_code || null,
          p_card_last4: result?.card_detail?.card_number || null,
          p_installments_number: result?.installments_number ?? null,
          p_payment_payload: payload,
        });

        if (error) {
          await markOrderForReview(admin, order.id, result);
          await logAuditEvent({
            eventType: AUDIT_EVENTS.PAYMENT_REVIEW_REQUIRED,
            userId: order.buyer_id || null,
            orderId: order.id,
            metadata: {
              provider: "webpay",
              reason: "settle_rpc_failed",
              buy_order: result?.buy_order || order.buy_order || null,
            },
          });

          console.error("[Webpay Return] Error consolidando pago autorizado", {
            orderId: order.id,
            error: error.message,
          });

          return { requiresReview: true };
        }

        const alreadyPaid = Boolean(data?.already_paid);
        return { alreadyPaid };
      },
      sendSuccessEffects: async ({ order, ticket, expectedAmountClp }) => {
        await sendSuccessEffects(admin, order, ticket, expectedAmountClp, baseUrl);
      },
      logAuditEvent,
      auditEvents: AUDIT_EVENTS,
    });

    return redirectToPayment(
      baseUrl,
      callbackResult?.redirectPayment || "unknown",
      callbackResult?.orderId || callbackResult?.order?.id || null
    );
  } catch (error) {
    console.error("[Webpay Return] Error procesando callback", {
      source,
      token: maskTokenForLog(token),
      error: error?.message || "unknown_error",
    });
    return redirectToPayment(baseUrl, "error");
  }
}

export async function POST(req) {
  const formData = await req.formData();
  return handleCallback({
    req,
    source: "POST",
    token: getPostString(formData, "token_ws"),
    buyOrder: getPostString(formData, "TBK_ORDEN_COMPRA"),
    sessionId: getPostString(formData, "TBK_ID_SESION"),
  });
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  return handleCallback({
    req,
    source: "GET",
    token: getQueryString(searchParams, "token_ws"),
    buyOrder: getQueryString(searchParams, "TBK_ORDEN_COMPRA"),
    sessionId: getQueryString(searchParams, "TBK_ID_SESION"),
  });
}
