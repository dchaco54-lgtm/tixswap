// lib/transbank.js
// Shim para compatibilidad con imports antiguos "@/lib/transbank"

export * from "./webpay";

// Opcional: re-export del SDK por si en otra parte lo usas así
export {
  WebpayPlus,
  Options,
  Environment,
  IntegrationApiKeys,
  IntegrationCommerceCodes,
} from "transbank-sdk";
