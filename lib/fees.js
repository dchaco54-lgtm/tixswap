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
// Ahora soporta 3 tipos de usuarios: admin, free, y básico (seller/buyer)
export function getFeeRatesForRole(role) {
  const normalizedRole = String(role || '').toLowerCase();

  // Admin y Free: sin comisión
  if (normalizedRole === 'admin' || normalizedRole === 'free') {
    return {
      platformRate: 0,
      minPlatformFee: 0,
      sellerRate: DEFAULT_SELLER_RATE,
    };
  }

  // Usuario básico (seller, buyer, etc): comisión normal
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
