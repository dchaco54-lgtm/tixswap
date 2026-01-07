// lib/fees.js

/**
 * MVP fees:
 * - Comprador: 6% con mínimo $300
 * - Vendedor: 0% (por ahora)
 *
 * Ojo: Dejé la estructura para roles, pero por ahora devuelve lo mismo para todos
 * (salvo admin/ultra_premium = 0%).
 */

export function getFeeRatesForRole(role) {
  const r = String(role || "").toLowerCase().trim();

  // si quieres dar 0% a estos roles:
  if (r === "admin" || r === "ultra_premium") {
    return { buyerRate: 0, sellerRate: 0 };
  }

  // MVP fijo para todos
  return { buyerRate: 0.06, sellerRate: 0 };
}

export function calcFees({
  basePrice,
  buyerRate = 0.025,
  sellerRate = 0,
  buyerMin = 300,
  sellerMin = 0,
}) {
  const price = Math.max(0, Number(basePrice ?? 0));

  const buyerFee = Math.round(Math.max(buyerMin, price * buyerRate));
  const sellerFee = Math.round(Math.max(sellerMin, price * sellerRate));

  const platformFee = buyerFee + sellerFee;
  const total = price + buyerFee;

  return {
    price,
    buyerFee,
    sellerFee,
    platformFee,
    total,
    buyerRate,
    sellerRate,
  };
}

// Mantengo tu helper anterior para no romper nada
export function getFees(priceCLP) {
  return calcFees({ basePrice: priceCLP, buyerRate: 0.06, sellerRate: 0, buyerMin: 300 });
}
