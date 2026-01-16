export const DEFAULT_PLATFORM_RATE = 0.025;
export const DEFAULT_MIN_PLATFORM_FEE = 1200;
export const DEFAULT_SELLER_RATE = 0;

export function formatPrice(amount) {
  const n = Number(amount || 0);
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(n);
}

export function calculateFees(
  ticketPrice,
  {
    platformRate = DEFAULT_PLATFORM_RATE,
    minPlatformFee = DEFAULT_MIN_PLATFORM_FEE,
    sellerRate = DEFAULT_SELLER_RATE,
  } = {}
) {
  const price = Math.max(0, Math.round(Number(ticketPrice || 0)));

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

// Backwards-compatible helpers used in some payment routes.
// En TixSwap la comisión es fija para todos (por ahora), por lo que el rol no cambia las tasas.
export function getFeeRatesForRole(_role) {
  return {
    platformRate: DEFAULT_PLATFORM_RATE,
    minPlatformFee: DEFAULT_MIN_PLATFORM_FEE,
    sellerRate: DEFAULT_SELLER_RATE,
  };
}

export function getFees(ticketPrice, { role, ...overrides } = {}) {
  const rates = getFeeRatesForRole(role);
  return calculateFees(ticketPrice, { ...rates, ...overrides });
}
