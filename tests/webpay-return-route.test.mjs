import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import { loadModule } from "./helpers/module-loader.mjs";

const routeModulePath = path.join(
  process.cwd(),
  "app/api/payments/webpay/return/route.js"
);

function buildNextServerStub() {
  return {
    NextResponse: {
      redirect(url, init = {}) {
        return {
          type: "redirect",
          url: String(url),
          status: init.status ?? 307,
        };
      },
    },
  };
}

function createAdminDouble({ order, updates }) {
  return {
    from(table) {
      return {
        _table: table,
        _action: null,
        _patch: null,
        _filters: [],
        select() {
          this._action = "select";
          return this;
        },
        update(patch) {
          this._action = "update";
          this._patch = patch;
          return this;
        },
        eq(column, value) {
          this._filters.push([column, value]);
          return this;
        },
        async maybeSingle() {
          if (this._table === "orders" && this._action === "select") {
            return { data: order || null, error: null };
          }
          return { data: null, error: null };
        },
        then(resolve, reject) {
          const payload = {
            table: this._table,
            patch: this._patch,
            filters: [...this._filters],
          };
          updates.push(payload);
          return Promise.resolve({ error: null }).then(resolve, reject);
        },
      };
    },
  };
}

async function loadRouteModule(stubs) {
  return loadModule(routeModulePath, { stubs });
}

test("cancelación previa al pago marca la orden como canceled y libera el ticket", async () => {
  const updates = [];
  const audits = [];
  const admin = createAdminDouble({
    order: {
      id: "order-1",
      ticket_id: "ticket-1",
      buyer_id: "buyer-1",
      status: "pending",
      session_id: "SESSION-1",
      buy_order: "BUY-1",
      amount_clp: 10000,
      total_clp: 10350,
      total_amount: 10350,
    },
    updates,
  });

  const route = await loadRouteModule({
    "next/server": buildNextServerStub(),
    "@/lib/email/resend": { sendEmail: async () => ({ ok: true }) },
    "@/lib/email/templates": {
      templateOrderPaidBuyer: () => ({ subject: "", html: "" }),
      templateOrderPaidSeller: () => ({ subject: "", html: "" }),
    },
    "@/lib/notifications": { createNotification: async () => ({ ok: true }) },
    "@/lib/payments/webpayCallback": {
      buildSafeWebpayPayload: (value) => value,
      maskTokenForLog: () => "***",
      processWebpayCallback: async () => ({ redirectPayment: "success", orderId: "x" }),
      WEBPAY_ORDER_STATUS: {
        PAID: "paid",
        CANCELED: "canceled",
        PAYMENT_REVIEW: "payment_review",
      },
      WEBPAY_PAYMENT_STATE: {
        CANCELED: "canceled",
        PAYMENT_REVIEW: "payment_review",
      },
    },
    "@/lib/security/audit": {
      AUDIT_EVENTS: {
        PAYMENT_CANCELED: "PAYMENT_CANCELED",
        PAYMENT_REVIEW_REQUIRED: "PAYMENT_REVIEW_REQUIRED",
      },
      logAuditEvent: async (payload) => audits.push(payload),
    },
    "@/lib/supabaseAdmin": { supabaseAdmin: () => admin },
    "@/lib/webpay": { getWebpayTransaction: () => ({}) },
  });

  const response = await route.POST({
    formData: async () => ({
      get(key) {
        if (key === "TBK_ORDEN_COMPRA") return "BUY-1";
        if (key === "TBK_ID_SESION") return "SESSION-1";
        return null;
      },
    }),
    nextUrl: { origin: "https://tixswap.cl" },
  });

  assert.equal(response.status, 303);
  assert.match(response.url, /payment=canceled/);
  assert.equal(updates.length, 2);
  assert.equal(audits.at(-1)?.eventType, "PAYMENT_CANCELED");
});

test("cancelación con session_id distinto deriva a review y no libera ticket", async () => {
  const updates = [];
  const audits = [];
  const admin = createAdminDouble({
    order: {
      id: "order-2",
      ticket_id: "ticket-2",
      buyer_id: "buyer-2",
      status: "pending",
      session_id: "SESSION-REAL",
      buy_order: "BUY-2",
      amount_clp: 10000,
      total_clp: 10350,
      total_amount: 10350,
    },
    updates,
  });

  const route = await loadRouteModule({
    "next/server": buildNextServerStub(),
    "@/lib/email/resend": { sendEmail: async () => ({ ok: true }) },
    "@/lib/email/templates": {
      templateOrderPaidBuyer: () => ({ subject: "", html: "" }),
      templateOrderPaidSeller: () => ({ subject: "", html: "" }),
    },
    "@/lib/notifications": { createNotification: async () => ({ ok: true }) },
    "@/lib/payments/webpayCallback": {
      buildSafeWebpayPayload: (value) => value,
      maskTokenForLog: () => "***",
      processWebpayCallback: async () => ({ redirectPayment: "success", orderId: "x" }),
      WEBPAY_ORDER_STATUS: {
        PAID: "paid",
        CANCELED: "canceled",
        PAYMENT_REVIEW: "payment_review",
      },
      WEBPAY_PAYMENT_STATE: {
        CANCELED: "canceled",
        PAYMENT_REVIEW: "payment_review",
      },
    },
    "@/lib/security/audit": {
      AUDIT_EVENTS: {
        PAYMENT_CANCELED: "PAYMENT_CANCELED",
        PAYMENT_REVIEW_REQUIRED: "PAYMENT_REVIEW_REQUIRED",
      },
      logAuditEvent: async (payload) => audits.push(payload),
    },
    "@/lib/supabaseAdmin": { supabaseAdmin: () => admin },
    "@/lib/webpay": { getWebpayTransaction: () => ({}) },
  });

  const response = await route.GET({
    url: "https://tixswap.cl/api/payments/webpay/return?TBK_ORDEN_COMPRA=BUY-2&TBK_ID_SESION=SESSION-OTRA",
    nextUrl: { origin: "https://tixswap.cl" },
  });

  assert.equal(response.status, 303);
  assert.match(response.url, /payment=review/);
  assert.equal(updates.length, 1);
  assert.equal(updates[0].table, "orders");
  assert.equal(audits.at(-1)?.eventType, "PAYMENT_REVIEW_REQUIRED");
});
