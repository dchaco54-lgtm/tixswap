import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import { loadModule } from "./helpers/module-loader.mjs";

const callbackModulePath = path.join(process.cwd(), "lib/payments/webpayCallback.js");

async function loadCallbackModule() {
  return loadModule(callbackModulePath);
}

function buildBaseOrder(overrides = {}) {
  return {
    id: "order-1",
    buy_order: "BUY-1",
    ticket_id: "ticket-1",
    buyer_id: "buyer-1",
    seller_id: "seller-1",
    status: "pending",
    payment_state: "session_created",
    amount_clp: 10000,
    amount: 10000,
    fee_clp: 350,
    total_clp: 10350,
    total_amount: 10350,
    currency: "CLP",
    session_id: "SESSION-1",
    ...overrides,
  };
}

function buildApprovedResult(overrides = {}) {
  return {
    buy_order: "BUY-1",
    session_id: "SESSION-1",
    amount: 10350,
    response_code: 0,
    status: "AUTHORIZED",
    authorization_code: "AUTH-1",
    payment_type_code: "VN",
    card_detail: { card_number: "4242" },
    installments_number: 0,
    ...overrides,
  };
}

function buildHarness(overrides = {}) {
  const calls = {
    updateOrderState: [],
    releaseTicket: [],
    settleApprovedPayment: [],
    sendSuccessEffects: [],
    logAuditEvent: [],
    logs: [],
  };

  const order = overrides.order ?? buildBaseOrder();
  const ticket = overrides.ticket ?? { id: "ticket-1", status: "held", event_id: "event-1" };
  const result = overrides.result ?? buildApprovedResult();

  return {
    calls,
    deps: {
      token: overrides.token ?? "token-secret-1234567890",
      source: overrides.source ?? "GET",
      commitTransaction: async () => result,
      loadOrderByBuyOrder: async () => order,
      loadTicketById: async () => ticket,
      settleApprovedPayment: async (payload) => {
        calls.settleApprovedPayment.push(payload);
        return overrides.settleResult ?? {};
      },
      updateOrderState: async (orderId, patch) => {
        calls.updateOrderState.push({ orderId, patch });
        if (overrides.updateOrderStateError) throw overrides.updateOrderStateError;
      },
      releaseTicket: async (ticketId) => {
        calls.releaseTicket.push(ticketId);
        if (overrides.releaseTicketError) throw overrides.releaseTicketError;
      },
      sendSuccessEffects: async (payload) => {
        calls.sendSuccessEffects.push(payload);
        if (overrides.sendSuccessEffectsError) throw overrides.sendSuccessEffectsError;
      },
      logAuditEvent: async (payload) => {
        calls.logAuditEvent.push(payload);
      },
      auditEvents: {
        PAYMENT_SUCCESS: "PAYMENT_SUCCESS",
        PAYMENT_FAILED: "PAYMENT_FAILED",
        PAYMENT_AMOUNT_MISMATCH: "PAYMENT_AMOUNT_MISMATCH",
      },
      logger: {
        info: (message, context) => calls.logs.push({ level: "info", message, context }),
        warn: (message, context) => calls.logs.push({ level: "warn", message, context }),
        error: (message, context) => calls.logs.push({ level: "error", message, context }),
      },
    },
  };
}

test("pago aprobado con monto correcto consolida una sola vez", async () => {
  const mod = await loadCallbackModule();
  const harness = buildHarness();

  const response = await mod.processWebpayCallback(harness.deps);

  assert.equal(response.ok, true);
  assert.equal(response.redirectPayment, "success");
  assert.equal(harness.calls.settleApprovedPayment.length, 1);
  assert.equal(harness.calls.sendSuccessEffects.length, 1);
  assert.equal(harness.calls.releaseTicket.length, 0);
  assert.equal(harness.calls.logAuditEvent.at(-1)?.eventType, "PAYMENT_SUCCESS");
});

test("pago aprobado con monto incorrecto pasa a revision y no envía efectos", async () => {
  const mod = await loadCallbackModule();
  const harness = buildHarness({
    result: buildApprovedResult({ amount: 9999 }),
  });

  const response = await mod.processWebpayCallback(harness.deps);

  assert.equal(response.ok, false);
  assert.equal(response.code, "amount_mismatch");
  assert.equal(response.redirectPayment, "review");
  assert.equal(harness.calls.updateOrderState.length, 1);
  assert.equal(harness.calls.settleApprovedPayment.length, 0);
  assert.equal(harness.calls.sendSuccessEffects.length, 0);
  assert.equal(
    harness.calls.logAuditEvent.at(-1)?.eventType,
    "PAYMENT_AMOUNT_MISMATCH"
  );
});

test("pago rechazado libera el ticket y marca failed", async () => {
  const mod = await loadCallbackModule();
  const harness = buildHarness({
    result: buildApprovedResult({
      response_code: -1,
      status: "FAILED",
    }),
  });

  const response = await mod.processWebpayCallback(harness.deps);

  assert.equal(response.ok, false);
  assert.equal(response.code, "failed");
  assert.equal(response.redirectPayment, "failed");
  assert.equal(harness.calls.updateOrderState.length, 1);
  assert.deepEqual(harness.calls.releaseTicket, ["ticket-1"]);
  assert.equal(harness.calls.logAuditEvent.at(-1)?.eventType, "PAYMENT_FAILED");
});

test("orden inexistente devuelve order_not_found", async () => {
  const mod = await loadCallbackModule();
  const harness = buildHarness();
  harness.deps.loadOrderByBuyOrder = async () => null;

  const response = await mod.processWebpayCallback(harness.deps);

  assert.equal(response.code, "order_not_found");
  assert.equal(response.redirectPayment, "order_not_found");
});

test("ticket inexistente deja la orden en review", async () => {
  const mod = await loadCallbackModule();
  const harness = buildHarness();
  harness.deps.loadTicketById = async () => null;

  const response = await mod.processWebpayCallback(harness.deps);

  assert.equal(response.code, "ticket_not_found");
  assert.equal(response.redirectPayment, "review");
  assert.equal(harness.calls.updateOrderState.length, 1);
  assert.equal(harness.calls.releaseTicket.length, 0);
});

test("callback duplicado sobre orden ya pagada no duplica efectos", async () => {
  const mod = await loadCallbackModule();
  const harness = buildHarness({ settleResult: { alreadyPaid: true } });

  const response = await mod.processWebpayCallback(harness.deps);

  assert.equal(response.code, "already_paid");
  assert.equal(response.redirectPayment, "success");
  assert.equal(harness.calls.sendSuccessEffects.length, 0);
  assert.equal(harness.calls.releaseTicket.length, 0);
});

test("si falla updateOrderState el callback rechaza y no sigue", async () => {
  const mod = await loadCallbackModule();
  const harness = buildHarness({
    result: buildApprovedResult({ amount: 9999 }),
    updateOrderStateError: new Error("db update failed"),
  });

  await assert.rejects(
    () => mod.processWebpayCallback(harness.deps),
    /db update failed/
  );

  assert.equal(harness.calls.settleApprovedPayment.length, 0);
  assert.equal(harness.calls.sendSuccessEffects.length, 0);
});

test("si falla releaseTicket el callback rechaza", async () => {
  const mod = await loadCallbackModule();
  const harness = buildHarness({
    result: buildApprovedResult({
      response_code: -1,
      status: "FAILED",
    }),
    releaseTicketError: new Error("ticket release failed"),
  });

  await assert.rejects(
    () => mod.processWebpayCallback(harness.deps),
    /ticket release failed/
  );
});

test("no registra token completo en logs cuando falta buy_order", async () => {
  const mod = await loadCallbackModule();
  const token = "token-super-secreto-123456789";
  const harness = buildHarness({
    token,
    result: buildApprovedResult({ buy_order: null }),
  });

  const response = await mod.processWebpayCallback(harness.deps);
  const loggedToken = harness.calls.logs[0]?.context?.token;

  assert.equal(response.code, "missing_buy_order");
  assert.ok(loggedToken);
  assert.notEqual(loggedToken, token);
  assert.ok(!String(loggedToken).includes(token));
});
