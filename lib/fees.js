// lib/fees.js

/**
 * Fees (MVP)
 * - Comisión TixSwap (comprador): 2.5% (sin mínimo)
 * - Vendedor: 0% (por ahora)
 *
 * Nota: Dejé estructura para roles por si más adelante quieres descuentos.
 */

export function getFeeRatesForRole(role) {
  const r = String(role || "").toLowerCase().trim();

  // 0% para admins / pruebas
  if (r === "admin" || r === "ultra_premium") {
    return { buyerRate: 0, sellerRate: 0 };
  }

  // Ejemplo de descuentos futuros
  if (r === "vip") {
    return { buyerRate: 0.015, sellerRate: 0 };
  }

  if (r === "premium") {
    return { buyerRate: 0.02, sellerRate: 0 };
  }

  // Default
  return { buyerRate: 0.025, sellerRate: 0 };
}

export function calcFees({
  basePrice,
  buyerRate = 0.025,
  sellerRate = 0,
  buyerMin = 0,
  sellerMin = 0,
}) {
  const base = Math.max(0, Number(basePrice) || 0);

  const buyerFee = Math.max(buyerMin, Math.round(base * buyerRate));
  const sellerFee = Math.max(sellerMin, Math.round(base * sellerRate));

  return {
    platformFee: buyerFee + sellerFee,
    buyerFee,
    sellerFee,
    total: base + buyerFee,
  };
}

export function getFees(amount, opts = {}) {
  return calcFees({
    basePrice: amount,
    buyerRate: opts.buyerRate ?? 0.025,
    sellerRate: opts.sellerRate ?? 0,
    buyerMin: opts.buyerMin ?? 0,
    sellerMin: opts.sellerMin ?? 0,
  });
}
