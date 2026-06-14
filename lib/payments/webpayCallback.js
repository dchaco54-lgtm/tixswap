import {
  buildExpectedWebpayOrderAmounts,
  normalizeClpAmount,
} from "./webpayAmounts.js";

export const WEBPAY_ORDER_STATUS = Object.freeze({
  PENDING: "pending",
  AUTHORIZED: "authorized",
  PAID: "paid",
  FAILED: "failed",
  CANCELED: "canceled",
  PAYMENT_REVIEW: "payment_review",
});

export const WEBPAY_PAYMENT_STATE = Object.freeze({
  PENDING: "pending",
  SESSION_CREATED: "session_created",
  AUTHORIZED: "AUTHORIZED",
  FAILED: "FAILED",
  CANCELED: "canceled",
  AMOUNT_MISMATCH: "failed_amount_mismatch",
  PAYMENT_REVIEW: "payment_review",
});

export function isApprovedWebpayResult(result) {
  return (
    Number(result?.response_code) === 0 &&
    String(result?.status || "").toUpperCase() === WEBPAY_PAYMENT_STATE.AUTHORIZED
  );
}

export function normalizeWebpayResponseCode(result) {
  const parsed = Number(result?.response_code);
  return Number.isFinite(parsed) ? parsed : null;
}

export function maskTokenForLog(token) {
  const value = String(token || "").trim();
  if (!value) return null;
  if (value.length <= 8) return "***";
  return `${value.slice(0, 2)}***${value.slice(-4)}`;
}

export function shouldReleaseTicketForResult(result) {
  const status = String(result?.status || "").toUpperCase();
  const responseCode = normalizeWebpayResponseCode(result);

  if (status === "AUTHORIZED" && responseCode === 0) {
    return false;
  }

  if (status === "FAILED") return true;
  if (status === "REVERSED") return true;
  if (status === "NULLIFIED") return true;
  if (responseCode !== null && responseCode !== 0) return true;

  return false;
}

export function buildAmountMismatchMetadata({ order, result }) {
  const expected = buildExpectedWebpayOrderAmounts(order);
  return {
    expected_amount_clp: expected.expectedAmountClp,
    received_amount_clp: normalizeClpAmount(result?.amount),
    response_code: normalizeWebpayResponseCode(result),
    provider_status: String(result?.status || "").toUpperCase() || null,
    buy_order: result?.buy_order || null,
  };
}

export function buildSafeWebpayPayload(result) {
  return {
    buy_order: result?.buy_order || null,
    session_id: result?.session_id || null,
    amount: normalizeClpAmount(result?.amount),
    status: String(result?.status || "").toUpperCase() || null,
    response_code: normalizeWebpayResponseCode(result),
    authorization_code: result?.authorization_code || null,
    payment_type_code: result?.payment_type_code || null,
    installments_number: normalizeClpAmount(result?.installments_number),
    card_last4: result?.card_detail?.card_number || null,
    transaction_date: result?.transaction_date || null,
    accounting_date: result?.accounting_date || null,
    vci: result?.vci || null,
  };
}

function createSafeLogger(logger) {
  return {
    info(message, context = {}) {
      if (logger?.info) logger.info(message, context);
    },
    warn(message, context = {}) {
      if (logger?.warn) logger.warn(message, context);
    },
    error(message, context = {}) {
      if (logger?.error) logger.error(message, context);
    },
  };
}

function buildOrderStatePatch({ status, paymentState, paymentPayload }) {
  return {
    status,
    payment_state: paymentState,
    payment_payload: buildSafeWebpayPayload(paymentPayload),
  };
}

function buildSuccessAuditMetadata({ order, result, expectedAmountClp }) {
  return {
    provider: "webpay",
    buy_order: result?.buy_order || order?.buy_order || null,
    response_code: normalizeWebpayResponseCode(result),
    payment_type_code: result?.payment_type_code || null,
    card_last4: result?.card_detail?.card_number || null,
    amount_clp: normalizeClpAmount(result?.amount),
    expected_amount_clp: expectedAmountClp,
  };
}

export async function processWebpayCallback({
  token,
  source,
  commitTransaction,
  loadOrderByBuyOrder,
  loadTicketById,
  settleApprovedPayment,
  updateOrderState,
  releaseTicket,
  sendSuccessEffects,
  logAuditEvent,
  auditEvents,
  logger,
}) {
  const safeLogger = createSafeLogger(logger);

  if (!token) {
    return { ok: false, code: "missing_token", redirectPayment: "unknown" };
  }

  const result = await commitTransaction(token);
  const buyOrder = String(result?.buy_order || "").trim();

  if (!buyOrder) {
    safeLogger.warn("[Webpay Return] Resultado sin buy_order", {
      source,
      response_code: normalizeWebpayResponseCode(result),
      status: String(result?.status || "").toUpperCase() || null,
      token: maskTokenForLog(token),
    });
    return { ok: false, code: "missing_buy_order", redirectPayment: "error" };
  }

  const order = await loadOrderByBuyOrder(buyOrder);
  if (!order) {
    safeLogger.warn("[Webpay Return] Orden no encontrada para buy_order", {
      source,
      buy_order: buyOrder,
      response_code: normalizeWebpayResponseCode(result),
      status: String(result?.status || "").toUpperCase() || null,
    });
    return {
      ok: false,
      code: "order_not_found",
      redirectPayment: "order_not_found",
      buyOrder,
      result,
    };
  }

  const ticketId = order?.ticket_id || null;
  if (!ticketId) {
    await updateOrderState(order.id, {
      ...buildOrderStatePatch({
        status: WEBPAY_ORDER_STATUS.PAYMENT_REVIEW,
        paymentState: WEBPAY_PAYMENT_STATE.PAYMENT_REVIEW,
        paymentPayload: result,
      }),
    });

    safeLogger.error("[Webpay Return] Orden sin ticket asociado", {
      source,
      order_id: order.id,
      buy_order: buyOrder,
    });

    return {
      ok: false,
      code: "missing_ticket_ref",
      redirectPayment: "review",
      order,
      result,
    };
  }

  const ticket = await loadTicketById(ticketId);
  if (!ticket) {
    await updateOrderState(order.id, {
      ...buildOrderStatePatch({
        status: WEBPAY_ORDER_STATUS.PAYMENT_REVIEW,
        paymentState: WEBPAY_PAYMENT_STATE.PAYMENT_REVIEW,
        paymentPayload: result,
      }),
    });

    safeLogger.error("[Webpay Return] Ticket no encontrado para orden", {
      source,
      order_id: order.id,
      ticket_id: ticketId,
      buy_order: buyOrder,
    });

    return {
      ok: false,
      code: "ticket_not_found",
      redirectPayment: "review",
      order,
      result,
    };
  }

  if (order.ticket_id !== ticket.id) {
    await updateOrderState(order.id, {
      ...buildOrderStatePatch({
        status: WEBPAY_ORDER_STATUS.PAYMENT_REVIEW,
        paymentState: WEBPAY_PAYMENT_STATE.PAYMENT_REVIEW,
        paymentPayload: result,
      }),
    });

    safeLogger.error("[Webpay Return] Inconsistencia orden-ticket", {
      source,
      order_id: order.id,
      order_ticket_id: order.ticket_id,
      loaded_ticket_id: ticket.id,
      buy_order: buyOrder,
    });

    return {
      ok: false,
      code: "ticket_mismatch",
      redirectPayment: "review",
      order,
      ticket,
      result,
    };
  }

  const amounts = buildExpectedWebpayOrderAmounts(order);
  const expectedAmountClp = amounts.expectedAmountClp;
  const receivedAmountClp = normalizeClpAmount(result?.amount);
  const responseCode = normalizeWebpayResponseCode(result);
  const providerStatus = String(result?.status || "").toUpperCase() || null;
  const resultSessionId = String(result?.session_id || "").trim() || null;
  const orderSessionId = String(order?.session_id || "").trim() || null;

  if (String(order?.status || "").toLowerCase() === WEBPAY_ORDER_STATUS.CANCELED) {
    await updateOrderState(order.id, {
      ...buildOrderStatePatch({
        status: WEBPAY_ORDER_STATUS.PAYMENT_REVIEW,
        paymentState: WEBPAY_PAYMENT_STATE.PAYMENT_REVIEW,
        paymentPayload: result,
      }),
    });

    safeLogger.warn("[Webpay Return] Callback autorizado sobre orden cancelada", {
      source,
      order_id: order.id,
      buy_order: buyOrder,
      response_code: responseCode,
      status: providerStatus,
    });

    return {
      ok: false,
      code: "order_canceled",
      redirectPayment: "review",
      order,
      ticket,
      result,
    };
  }

  if (!Number.isInteger(expectedAmountClp) || expectedAmountClp <= 0) {
    await updateOrderState(order.id, {
      ...buildOrderStatePatch({
        status: WEBPAY_ORDER_STATUS.PAYMENT_REVIEW,
        paymentState: WEBPAY_PAYMENT_STATE.PAYMENT_REVIEW,
        paymentPayload: result,
      }),
    });

    safeLogger.error("[Webpay Return] Orden sin monto esperado valido", {
      source,
      order_id: order.id,
      buy_order: buyOrder,
    });

    return {
      ok: false,
      code: "missing_expected_amount",
      redirectPayment: "review",
      order,
      ticket,
      result,
    };
  }

  if (!Number.isInteger(receivedAmountClp) || receivedAmountClp <= 0) {
    await updateOrderState(order.id, {
      ...buildOrderStatePatch({
        status: WEBPAY_ORDER_STATUS.PAYMENT_REVIEW,
        paymentState: WEBPAY_PAYMENT_STATE.PAYMENT_REVIEW,
        paymentPayload: result,
      }),
    });

    safeLogger.warn("[Webpay Return] Resultado sin monto valido", {
      source,
      order_id: order.id,
      buy_order: buyOrder,
      response_code: responseCode,
      status: providerStatus,
    });

    return {
      ok: false,
      code: "invalid_result_amount",
      redirectPayment: "review",
      order,
      ticket,
      result,
    };
  }

  if (orderSessionId && (!resultSessionId || resultSessionId !== orderSessionId)) {
    await updateOrderState(order.id, {
      ...buildOrderStatePatch({
        status: WEBPAY_ORDER_STATUS.PAYMENT_REVIEW,
        paymentState: WEBPAY_PAYMENT_STATE.PAYMENT_REVIEW,
        paymentPayload: result,
      }),
    });

    safeLogger.warn("[Webpay Return] session_id no coincide", {
      source,
      order_id: order.id,
      buy_order: buyOrder,
      response_code: responseCode,
      status: providerStatus,
    });

    return {
      ok: false,
      code: "session_mismatch",
      redirectPayment: "review",
      order,
      ticket,
      result,
    };
  }

  if (isApprovedWebpayResult(result)) {
    if (receivedAmountClp !== expectedAmountClp) {
      await updateOrderState(order.id, {
        ...buildOrderStatePatch({
          status: WEBPAY_ORDER_STATUS.PAYMENT_REVIEW,
          paymentState: WEBPAY_PAYMENT_STATE.AMOUNT_MISMATCH,
          paymentPayload: result,
        }),
      });

      await logAuditEvent({
        eventType:
          auditEvents?.PAYMENT_AMOUNT_MISMATCH || "PAYMENT_AMOUNT_MISMATCH",
        userId: order.buyer_id || null,
        orderId: order.id,
        metadata: buildAmountMismatchMetadata({ order, result }),
      });

      safeLogger.warn("[Webpay Return] Monto autorizado no coincide", {
        source,
        order_id: order.id,
        buy_order: buyOrder,
        expected_amount_clp: expectedAmountClp,
        received_amount_clp: receivedAmountClp,
        response_code: responseCode,
      });

      return {
        ok: false,
        code: "amount_mismatch",
        redirectPayment: "review",
        order,
        ticket,
        result,
      };
    }

    const settleResult = await settleApprovedPayment({
      order,
      ticket,
      result,
      expectedAmountClp,
      token,
    });

    if (settleResult?.alreadyPaid) {
      safeLogger.info("[Webpay Return] Callback idempotente sobre orden pagada", {
        source,
        order_id: order.id,
        buy_order: buyOrder,
        response_code: responseCode,
      });

      return {
        ok: true,
        code: "already_paid",
        redirectPayment: "success",
        orderId: order.id,
        order,
        ticket,
        result,
        expectedAmountClp,
      };
    }

    if (settleResult?.requiresReview) {
      safeLogger.error("[Webpay Return] No se pudo consolidar el pago autorizado", {
        source,
        order_id: order.id,
        buy_order: buyOrder,
        response_code: responseCode,
      });

      return {
        ok: false,
        code: "settlement_failed",
        redirectPayment: "review",
        order,
        ticket,
        result,
      };
    }

    await sendSuccessEffects({ order, ticket, result, expectedAmountClp });

    await logAuditEvent({
      eventType: auditEvents?.PAYMENT_SUCCESS || "PAYMENT_SUCCESS",
      userId: order.buyer_id || null,
      orderId: order.id,
      metadata: buildSuccessAuditMetadata({
        order,
        result,
        expectedAmountClp,
      }),
    });

    safeLogger.info("[Webpay Return] Pago confirmado", {
      source,
      order_id: order.id,
      buy_order: buyOrder,
      response_code: responseCode,
      amount_clp: expectedAmountClp,
    });

    return {
      ok: true,
      code: "paid",
      redirectPayment: "success",
      orderId: order.id,
      order,
      ticket,
      result,
      expectedAmountClp,
    };
  }

  const failedPatch = buildOrderStatePatch({
    status: shouldReleaseTicketForResult(result)
      ? WEBPAY_ORDER_STATUS.FAILED
      : WEBPAY_ORDER_STATUS.PAYMENT_REVIEW,
    paymentState: shouldReleaseTicketForResult(result)
      ? providerStatus || WEBPAY_PAYMENT_STATE.FAILED
      : WEBPAY_PAYMENT_STATE.PAYMENT_REVIEW,
    paymentPayload: result,
  });

  await updateOrderState(order.id, failedPatch);

  if (shouldReleaseTicketForResult(result)) {
    await releaseTicket(ticket.id);
    await logAuditEvent({
      eventType: auditEvents?.PAYMENT_FAILED || "PAYMENT_FAILED",
      userId: order.buyer_id || null,
      orderId: order.id,
      metadata: {
        provider: "webpay",
        response_code: responseCode,
        status: providerStatus,
      },
    });

    safeLogger.info("[Webpay Return] Pago rechazado o fallido", {
      source,
      order_id: order.id,
      buy_order: buyOrder,
      response_code: responseCode,
      status: providerStatus,
    });

    return {
      ok: false,
      code: "failed",
      redirectPayment: "failed",
      order,
      ticket,
      result,
    };
  }

  safeLogger.warn("[Webpay Return] Resultado incompleto, se envia a revision", {
    source,
    order_id: order.id,
    buy_order: buyOrder,
    response_code: responseCode,
    status: providerStatus,
  });

  return {
    ok: false,
    code: "payment_review",
    redirectPayment: "review",
    order,
    ticket,
    result,
  };
}
