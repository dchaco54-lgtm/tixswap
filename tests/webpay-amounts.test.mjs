import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import { loadModule } from "./helpers/module-loader.mjs";

const amountsModulePath = path.join(process.cwd(), "lib/payments/webpayAmounts.js");

async function loadAmountsModule() {
  return loadModule(amountsModulePath);
}

test("calcula montos CLP enteros para Webpay", async () => {
  const mod = await loadAmountsModule();

  const amounts = mod.calculateWebpayOrderAmounts({
    ticketPrice: 10000,
    sellerTier: "basic",
  });

  assert.equal(amounts.ticketAmountClp, 10000);
  assert.equal(amounts.feeAmountClp, 350);
  assert.equal(amounts.totalAmountClp, 10350);
});

test("prioriza total_clp como monto esperado de la orden", async () => {
  const mod = await loadAmountsModule();

  assert.equal(
    mod.getExpectedWebpayOrderAmount({
      total_clp: 11234,
      total_amount: 9988,
      amount_clp: 9000,
      fee_clp: 350,
    }),
    11234
  );
});

test("usa fallback legacy si total_clp no existe", async () => {
  const mod = await loadAmountsModule();

  assert.equal(
    mod.getExpectedWebpayOrderAmount({
      total_amount: 10350,
      amount_clp: 10000,
      fee_clp: 350,
    }),
    10350
  );
});
