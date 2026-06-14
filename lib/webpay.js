import {
  Environment,
  IntegrationApiKeys,
  IntegrationCommerceCodes,
  Options,
  WebpayPlus,
} from "transbank-sdk";

const PRODUCTION_WEBPAY_ENVS = new Set(["production", "prod", "live"]);

export function isProductionWebpayEnv(value = process.env.WEBPAY_ENV) {
  const normalized = String(value || "integration").trim().toLowerCase();
  return PRODUCTION_WEBPAY_ENVS.has(normalized);
}

export function resolveWebpayEnvironmentLabel(value = process.env.WEBPAY_ENV) {
  return isProductionWebpayEnv(value) ? "PRODUCTION" : "INTEGRATION";
}

export function buildWebpayOptions({
  webpayEnv = process.env.WEBPAY_ENV,
  commerceCode = process.env.WEBPAY_COMMERCE_CODE,
  apiKeySecret = process.env.WEBPAY_API_KEY_SECRET,
  logger = console,
} = {}) {
  const isProduction = isProductionWebpayEnv(webpayEnv);

  if (isProduction) {
    if (!String(commerceCode || "").trim()) {
      throw new Error(
        "WEBPAY_ENV apunta a producción, pero falta WEBPAY_COMMERCE_CODE."
      );
    }

    if (!String(apiKeySecret || "").trim()) {
      throw new Error(
        "WEBPAY_ENV apunta a producción, pero falta WEBPAY_API_KEY_SECRET."
      );
    }

    logger?.log?.("[Webpay] Ambiente: PRODUCTION");
    return new Options(
      String(commerceCode).trim(),
      String(apiKeySecret).trim(),
      Environment.Production
    );
  }

  logger?.log?.("[Webpay] Ambiente: INTEGRATION");
  return new Options(
    IntegrationCommerceCodes.WEBPAY_PLUS,
    IntegrationApiKeys.WEBPAY,
    Environment.Integration
  );
}

export function getWebpayOptions() {
  return buildWebpayOptions();
}

export function getWebpayTransaction() {
  const opts = getWebpayOptions();
  return new WebpayPlus.Transaction(opts);
}
