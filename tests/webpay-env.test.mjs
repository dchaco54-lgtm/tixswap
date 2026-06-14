import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import { loadModule } from "./helpers/module-loader.mjs";

const webpayModulePath = path.join(process.cwd(), "lib/webpay.js");

function buildSdkStub() {
  class OptionsStub {
    constructor(commerceCode, apiKey, environment) {
      this.commerceCode = commerceCode;
      this.apiKey = apiKey;
      this.environment = environment;
    }
  }

  class TransactionStub {
    constructor(options) {
      this.options = options;
    }
  }

  return {
    Environment: {
      Production: "production-env",
      Integration: "integration-env",
    },
    IntegrationApiKeys: {
      WEBPAY: "integration-api-key",
    },
    IntegrationCommerceCodes: {
      WEBPAY_PLUS: "integration-commerce-code",
    },
    Options: OptionsStub,
    WebpayPlus: {
      Transaction: TransactionStub,
    },
  };
}

async function loadWebpayModule() {
  return loadModule(webpayModulePath, {
    stubs: {
      "transbank-sdk": buildSdkStub(),
    },
  });
}

test("usa Integration por defecto aunque no existan variables", async () => {
  const mod = await loadWebpayModule();
  const logs = [];

  const options = mod.buildWebpayOptions({
    webpayEnv: undefined,
    commerceCode: undefined,
    apiKeySecret: undefined,
    logger: { log: (message) => logs.push(message) },
  });

  assert.equal(options.environment, "integration-env");
  assert.equal(options.commerceCode, "integration-commerce-code");
  assert.equal(options.apiKey, "integration-api-key");
  assert.deepEqual(logs, ["[Webpay] Ambiente: INTEGRATION"]);
});

test("mantiene Integration aunque existan credenciales productivas si WEBPAY_ENV no es prod", async () => {
  const mod = await loadWebpayModule();

  const options = mod.buildWebpayOptions({
    webpayEnv: "integration",
    commerceCode: "real-commerce-ignored",
    apiKeySecret: "real-key-ignored",
    logger: { log() {} },
  });

  assert.equal(options.environment, "integration-env");
  assert.equal(options.commerceCode, "integration-commerce-code");
  assert.equal(options.apiKey, "integration-api-key");
});

test("usa Production sólo cuando WEBPAY_ENV es production con variables completas", async () => {
  const mod = await loadWebpayModule();
  const logs = [];

  const options = mod.buildWebpayOptions({
    webpayEnv: "production",
    commerceCode: "commerce-code",
    apiKeySecret: "api-key-secret",
    logger: { log: (message) => logs.push(message) },
  });

  assert.equal(options.environment, "production-env");
  assert.equal(options.commerceCode, "commerce-code");
  assert.equal(options.apiKey, "api-key-secret");
  assert.deepEqual(logs, ["[Webpay] Ambiente: PRODUCTION"]);
});

test("falla en Production si falta WEBPAY_COMMERCE_CODE", async () => {
  const mod = await loadWebpayModule();

  assert.throws(
    () =>
      mod.buildWebpayOptions({
        webpayEnv: "prod",
        commerceCode: "",
        apiKeySecret: "api-key-secret",
        logger: { log() {} },
      }),
    /WEBPAY_COMMERCE_CODE/
  );
});

test("falla en Production si falta WEBPAY_API_KEY_SECRET", async () => {
  const mod = await loadWebpayModule();

  assert.throws(
    () =>
      mod.buildWebpayOptions({
        webpayEnv: "live",
        commerceCode: "commerce-code",
        apiKeySecret: "",
        logger: { log() {} },
      }),
    /WEBPAY_API_KEY_SECRET/
  );
});
