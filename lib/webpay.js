// lib/webpay.js
// Helper para crear una instancia configurada de Webpay Plus (Transbank)
// En integración usa credenciales del SDK.
// En producción debes setear WEBPAY_COMMERCE_CODE y WEBPAY_API_KEY_SECRET.

import {
  Environment,
  IntegrationApiKeys,
  IntegrationCommerceCodes,
  Options,
  WebpayPlus,
} from "transbank-sdk";

function readEnv() {
  const raw = String(process.env.WEBPAY_ENV || "integration").toLowerCase();
  const isProd = raw === "prod" || raw === "production" || raw === "live";
  return { isProd };
}

export function getWebpayOptions() {
  const { isProd } = readEnv();

  if (!isProd) {
    return new Options(
      IntegrationCommerceCodes.WEBPAY_PLUS,
      IntegrationApiKeys.WEBPAY,
      Environment.Integration
    );
  }

  const commerceCode = process.env.WEBPAY_COMMERCE_CODE;
  const apiKeySecret = process.env.WEBPAY_API_KEY_SECRET;

  if (!commerceCode || !apiKeySecret) {
    throw new Error(
      "Faltan credenciales de producción. Define WEBPAY_COMMERCE_CODE y WEBPAY_API_KEY_SECRET."
    );
  }

  return new Options(commerceCode, apiKeySecret, Environment.Production);
}

export function getWebpayTransaction() {
  const opts = getWebpayOptions();
  return new WebpayPlus.Transaction(opts);
}
