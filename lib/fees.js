// lib/fees.js
// Reglas de negocio (Buyer fee):
// - Cargo TixSwap = 2.5% del precio
// - Mínimo CLP $1.200
// Nota: Si en el futuro quieres tiers, hazlo en sellerFee separado,
// pero el cargo al comprador se mantiene como regla fija.

export const DEFAULT_PLATFORM_RATE = 0.025;
export const DEFAULT_MIN_PLATFORM_FEE = 1200;

// (Opcional) fee del seller si lo usas en otros lados
export const DEFAULT_SELLER_RATE = 0.0;

export function formatPrice(value) {
  const n = Number(value || 0);
  return n.toLocaleString("es-CL", { maximumFractionDigits: 0 });
}

// Calcula el cargo al comprador (y derivados)
export function calculateFees(ticketPrice, options = {}) {
  const price = Math.max(0, Math.round(Number(ticketPrice) || 0));

  // Mantén regla fija SIEMPRE (evita “tier = string” cagándola)
  let platformRate = DEFAULT_PLATFORM_RATE;
  let minPlatformFee = DEFAULT_MIN_PLATFORM_FEE;
  let sellerRate = DEFAULT_SELLER_RATE;

  // Permite override SOLO si viene objeto (no string)
  if (options && typeof options === "object" && !Array.isArray(options)) {
    if (typeof options.platformRate === "number") platformRate = options.platformRate;
    if (typeof options.minPlatformFee === "number") minPlatformFee = options.minPlatformFee;
    if (typeof options.sellerRate === "number") sellerRate = options.sellerRate;
  }

  const platformFee = Math.max(Math.round(price * platformRate), minPlatformFee);
  const sellerFee = Math.round(price * sellerRate);
  const sellerPayout = Math.max(0, price - sellerFee);
  const totalDue = price + platformFee;

  return {
    ticketPrice: price,
    platformRate,
    minPlatformFee,
    platformFee,
    sellerRate,
    sellerFee,
    sellerPayout,
    totalDue,
  };
}

// Helpers (por si lo llamas desde UI)
export function getFees(ticketPrice, options = {}) {
  return calculateFees(ticketPrice, options);
}

// Si tienes lógica de tiers del seller, déjala separada aquí (no toca buyer fee)
const TIER_COMMISSIONS = {
  basic: 0.035,
  pro: 0.03,
  premium: 0.025,
  elite: 0.02,
};

export function calculateSellerFee(ticketPrice, sellerTier = "basic") {
  const price = Math.max(0, Math.round(Number(ticketPrice) || 0));
  const tier = String(sellerTier || "basic").toLowerCase();
  const commission = TIER_COMMISSIONS[tier] ?? TIER_COMMISSIONS.basic;

  // Ojo: esto es fee del seller (si lo usas). Buyer fee sigue fijo arriba.
  const sellerFee = Math.round(price * commission);

  return {
    sellerTier: tier,
    sellerRate: commission,
    sellerFee,
    sellerPayout: Math.max(0, price - sellerFee),
  };
}

