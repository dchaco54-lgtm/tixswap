export const DEFAULT_PLATFORM_RATE = 0.025;
export const DEFAULT_MIN_PLATFORM_FEE = 1200;
export const DEFAULT_SELLER_RATE = 0;

// Comisiones por rol (debe coincidir con lib/roles.js)
const ROLE_COMMISSIONS = {
  'basic': 0.035,
  'free': 0,
  'pro': 0.025,
  'premium': 0.015,
  'elite': 0.005,
  'ultra': 0,
  'admin': 0,
};

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
  sellerRoleOrOptions = {}
) {
  const price = Math.max(0, Math.round(Number(ticketPrice || 0)));

  let platformRate = DEFAULT_PLATFORM_RATE;
  let minPlatformFee = DEFAULT_MIN_PLATFORM_FEE;
  let sellerRate = DEFAULT_SELLER_RATE;

  // Si es un string, es el rol del vendedor
  if (typeof sellerRoleOrOptions === 'string') {
    const role = String(sellerRoleOrOptions).toLowerCase().trim();
    const commission = ROLE_COMMISSIONS[role] !== undefined ? ROLE_COMMISSIONS[role] : ROLE_COMMISSIONS['basic'];
    platformRate = commission;
    minPlatformFee = 0; // Sin mínimo para sellers con comisión dinámica
  } else if (typeof sellerRoleOrOptions === 'object') {
    // Backward compatible: { platformRate, minPlatformFee, sellerRate }
    const opts = sellerRoleOrOptions;
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

// Backwards-compatible helpers used in some payment routes.
export function getFeeRatesForRole(role) {
  const normalizedRole = String(role || 'basic').toLowerCase().trim();
  const commission = ROLE_COMMISSIONS[normalizedRole] !== undefined 
    ? ROLE_COMMISSIONS[normalizedRole] 
    : ROLE_COMMISSIONS['basic'];
  
  return {
    platformRate: commission,
    minPlatformFee: 0,
    sellerRate: DEFAULT_SELLER_RATE,
  };
}

export function getFees(ticketPrice, { role, ...overrides } = {}) {
  const rates = getFeeRatesForRole(role);
  return calculateFees(ticketPrice, { ...rates, ...overrides });
}
