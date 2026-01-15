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

  // Intentar usar credenciales de producción si están disponibles
  const commerceCode = process.env.WEBPAY_COMMERCE_CODE;
  const apiKeySecret = process.env.WEBPAY_API_KEY_SECRET;

  // Si tenemos ambas credenciales, usamos producción
  if (commerceCode && apiKeySecret) {
    console.log("[Webpay] Usando ambiente PRODUCTION con código:", commerceCode.slice(0, 4) + "...");
    return new Options(commerceCode, apiKeySecret, Environment.Production);
  }

  // Si se fuerza producción pero no hay credenciales, error
  if (isProd) {
    throw new Error(
      "Ambiente de PRODUCCIÓN solicitado pero faltan credenciales. Define WEBPAY_COMMERCE_CODE y WEBPAY_API_KEY_SECRET."
    );
  }

  // Por defecto, usar integración
  console.log("[Webpay] Usando ambiente INTEGRATION (modo desarrollo)");
  return new Options(
    IntegrationCommerceCodes.WEBPAY_PLUS,
    IntegrationApiKeys.WEBPAY,
    Environment.Integration
  );
}

export function getWebpayTransaction() {
  const opts = getWebpayOptions();
  return new WebpayPlus.Transaction(opts);
}
