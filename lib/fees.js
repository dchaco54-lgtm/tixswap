// lib/fees.js
// Cálculo centralizado de cargos por servicio (comprador / vendedor) para TixSwap.
// CLP no usa decimales -> redondeamos a pesos.

export const DEFAULT_BUYER_FEE_RATE = 0.02;  // 2.0%
export const DEFAULT_SELLER_FEE_RATE = 0.02; // 2.0%

export function roundCLP(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  // CLP: redondeo a peso
  return Math.max(0, Math.round(n));
}

export function formatCLP(value) {
  const n = roundCLP(value);
  return n.toLocaleString("es-CL");
}

/**
 * Retorna las tasas según el rol del usuario.
 * - ultra_premium: 0% (comprador y vendedor)
 * - admin: 0%
 * - resto: 2.0% comprador y 2.0% vendedor
 */
export function getFeeRatesForRole(role) {
  const r = String(role || "").toLowerCase();
  if (r === "ultra_premium" || r === "ultra" || r === "ultra-premium") {
    return { buyerRate: 0, sellerRate: 0 };
  }
  if (r === "admin") {
    return { buyerRate: 0, sellerRate: 0 };
  }
  return {
    buyerRate: DEFAULT_BUYER_FEE_RATE,
    sellerRate: DEFAULT_SELLER_FEE_RATE,
  };
}

/**
 * Cálculo de breakdown.
 * basePrice: precio publicado (CLP)
 * buyerRate: % sobre basePrice (cargo comprador)
 * sellerRate: % sobre basePrice (cargo vendedor)
 */
export function calcFees({ basePrice, buyerRate = DEFAULT_BUYER_FEE_RATE, sellerRate = DEFAULT_SELLER_FEE_RATE } = {}) {
  const base = roundCLP(basePrice);
  const buyerFee = roundCLP(base * Number(buyerRate || 0));
  const sellerFee = roundCLP(base * Number(sellerRate || 0));

  const totalPaid = base + buyerFee;        // lo que paga el comprador
  const sellerPayout = base - sellerFee;   // lo que recibe el vendedor
  const platformGross = buyerFee + sellerFee;

  return {
    base,
    buyerRate: Number(buyerRate || 0),
    sellerRate: Number(sellerRate || 0),
    buyerFee,
    sellerFee,
    totalPaid,
    sellerPayout,
    platformGross,
  };
}

/**
 * Helper para armar items (útil para Webpay / conciliación)
 */
export function buildServiceItemsFromFees(fees) {
  const f = fees || {};
  return [
    { code: "BASE", label: "Entrada", amount_clp: roundCLP(f.base) },
    { code: "FEE_BUYER", label: "Cargo por servicio (comprador)", amount_clp: roundCLP(f.buyerFee) },
    { code: "FEE_SELLER", label: "Cargo por servicio (vendedor)", amount_clp: roundCLP(f.sellerFee) },
  ];
}
