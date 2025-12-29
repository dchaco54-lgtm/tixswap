// lib/fees.js

export function roundCLP(n) {
  // CLP no usa decimales, igual lo redondeamos seguro
  return Math.round(Number(n || 0));
}

export function formatCLP(n) {
  try {
    return new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency: "CLP",
      maximumFractionDigits: 0,
    }).format(roundCLP(n));
  } catch {
    return `$${roundCLP(n)}`;
  }
}

/**
 * Comisión por rol (MVP):
 * - super_premium / ultra_premium / admin => 0%
 * - resto => 2%
 */
export function getFeeRatesForRole(role) {
  const r = (role || "standard").toLowerCase();

  const zeroFeeRoles = new Set(["super_premium", "ultra_premium", "admin"]);
  const rate = zeroFeeRoles.has(r) ? 0 : 0.02;

  return {
    buyerRate: rate,
    sellerRate: rate,
  };
}

/**
 * Calcula fees separados (buyer y seller) en base al precio base.
 */
export function calcFees({ basePrice, buyerRate, sellerRate }) {
  const price = roundCLP(basePrice);

  const br = Number(buyerRate ?? 0);
  const sr = Number(sellerRate ?? 0);

  const buyerFee = roundCLP(price * br);
  const sellerFee = roundCLP(price * sr);

  const totalToPay = roundCLP(price + buyerFee);
  const sellerPayout = roundCLP(price - sellerFee);

  return {
    basePrice: price,
    buyerRate: br,
    sellerRate: sr,
    buyerFee,
    sellerFee,
    totalToPay,
    sellerPayout,
  };
}

