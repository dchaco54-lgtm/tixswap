// lib/fees.js

// Buyer fee (siempre fijo)
export const DEFAULT_PLATFORM_RATE = 0.025;
export const DEFAULT_MIN_PLATFORM_FEE = 1200;

// Helpers
export function formatPrice(value) {
  const n = Number(value || 0);
  return n.toLocaleString("es-CL", { maximumFractionDigits: 0 });
}

function toCLP(value) {
  const n = Math.round(Number(value) || 0);
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

function normalizeRole(role) {
  const r = String(role || "").toLowerCase().trim();
  if (!r) return "standard";
  if (r === "basic") return "standard";
  return r;
}

function isFreeOrAdmin(role) {
  const r = normalizeRole(role);
  return r === "free" || r === "admin";
}

/**
 * Buyer fees (precio + fee comprador)
 * Mantiene: 2.5% mínimo $1.200
 */
export function calculateFees(ticketPrice, options = {}) {
  const price = toCLP(ticketPrice);

  let platformRate = DEFAULT_PLATFORM_RATE;
  let minPlatformFee = DEFAULT_MIN_PLATFORM_FEE;

  // overrides seguros
  if (options && typeof options === "object" && !Array.isArray(options)) {
    if (typeof options.platformRate === "number") platformRate = options.platformRate;
    if (typeof options.minPlatformFee === "number") minPlatformFee = options.minPlatformFee;
  }

  const platformFee = Math.max(Math.round(price * platformRate), minPlatformFee);
  const totalDue = price + platformFee;

  return {
    ticketPrice: price,
    platformRate,
    minPlatformFee,
    platformFee,
    totalDue,
  };
}

export function getFees(ticketPrice, options = {}) {
  return calculateFees(ticketPrice, options);
}

/**
 * Seller fee (cargo por servicio al vendedor)
 * Mantiene: 2.5% mínimo $1.200
 * EXCEPCIÓN: free/admin => $0
 */
export function calculateSellerFee(ticketPrice, userRole = "standard") {
  const price = toCLP(ticketPrice);
  if (isFreeOrAdmin(userRole)) return 0;

  const fee = Math.max(Math.round(price * DEFAULT_PLATFORM_RATE), DEFAULT_MIN_PLATFORM_FEE);
  return fee;
}

export function calculateSellerPayout(ticketPrice, userRole = "standard") {
  const price = toCLP(ticketPrice);
  const fee = calculateSellerFee(price, userRole);
  return Math.max(0, price - fee);
}
