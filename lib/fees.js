import { normalizeTier, TIERS, getTierCommissionPercent } from './tiers';

export const DEFAULT_PLATFORM_RATE = 0.025;
export const DEFAULT_MIN_PLATFORM_FEE = 1200;
export const DEFAULT_SELLER_RATE = 0;

// Comisión de referencia por tier (debe coincidir con lib/tiers.js)
const TIER_COMMISSIONS = {
  [TIERS.BASIC]: 0.035,
  [TIERS.PRO]: 0.03,
  [TIERS.ELITE]: 0.025,
};

function normalizeSellerTier(tier) {
  return normalizeTier(tier || TIERS.BASIC);
}

export function formatPrice(amount) {
  const n = Number(amount || 0);
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(n);
}

// === SELLER FEE HELPERS ===
// Calcula el cargo por servicio que paga el vendedor según su seller_tier
export function calculateSellerFee(ticketPrice, sellerTier) {
  const price = Math.round(Number(ticketPrice || 0));
  const tier = normalizeSellerTier(sellerTier);
  const commission = getTierCommissionPercent(tier) ?? TIER_COMMISSIONS[TIERS.BASIC];

  const fee = Math.round(price * commission);
  return Math.max(fee, DEFAULT_MIN_PLATFORM_FEE);
}

// Calcula lo que recibe el vendedor después del cargo
export function calculateSellerPayout(ticketPrice, sellerTier) {
  const price = Math.round(Number(ticketPrice || 0));
  const fee = calculateSellerFee(price, sellerTier);
  return Math.max(0, price - fee);
}

// Alias para consistencia retro (recibe seller_tier)
export function feeForRole(ticketPrice, sellerTier) {
  return calculateSellerFee(ticketPrice, sellerTier);
}

// === BUYER FEE HELPERS ===
export function calculateFees(ticketPrice, sellerTierOrOptions = {}) {
  const price = Math.max(0, Math.round(Number(ticketPrice || 0)));

  let platformRate = DEFAULT_PLATFORM_RATE;
  let minPlatformFee = DEFAULT_MIN_PLATFORM_FEE;
  let sellerRate = DEFAULT_SELLER_RATE;

  // Si es un string, es el seller_tier del vendedor
  if (typeof sellerTierOrOptions === 'string') {
    const tier = normalizeSellerTier(sellerTierOrOptions);
    const commission = TIER_COMMISSIONS[tier] ?? TIER_COMMISSIONS[TIERS.BASIC];
    platformRate = commission;
    minPlatformFee = 0; // sin mínimo cuando se calcula por tier dinámico
  } else if (typeof sellerTierOrOptions === 'object') {
    // Backward compatible: { platformRate, minPlatformFee, sellerRate }
    const opts = sellerTierOrOptions;
    if (opts.platformRate !== undefined) platformRate = opts.platformRate;
    if (opts.minPlatformFee !== undefined) minPlatformFee = opts.minPlatformFee;
    if (opts.sellerRate !== undefined) sellerRate = opts.sellerRate;
  }

  const rawPlatformFee = Math.round(price * platformRate);
  const platformFee = price === 0 ? 0 : Math.max(rawPlatformFee, minPlatformFee);

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

// Helpers usados en rutas de pago. sellerTier = basic|pro|elite
export function getFeeRatesForTier(sellerTier) {
  const tier = normalizeSellerTier(sellerTier);
  const commission = TIER_COMMISSIONS[tier] ?? TIER_COMMISSIONS[TIERS.BASIC];

  return {
    platformRate: commission,
    minPlatformFee: 0,
    sellerRate: DEFAULT_SELLER_RATE,
  };
}

// Alias retrocompatibilidad
export const getFeeRatesForRole = getFeeRatesForTier;

export function getFees(ticketPrice, { sellerTier, role, ...overrides } = {}) {
  const baseTier = sellerTier || role; // role se mantiene por compatibilidad
  const rates = getFeeRatesForTier(baseTier);
  return calculateFees(ticketPrice, { ...rates, ...overrides });
}
