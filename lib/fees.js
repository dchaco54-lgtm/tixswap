// lib/fees.js
// Fuente única de verdad para cálculos de fees.
// ✅ Regla de negocio actual:
// - Cargo TixSwap (fee plataforma) = 2.5% del precio (redondeado)
// - Fee mínimo = 1.200 CLP (si el 2.5% < 1.200, se cobra 1.200)
// - Si el precio es 0, el fee es 0

export const DEFAULT_PLATFORM_RATE = 0.025;
export const DEFAULT_MIN_PLATFORM_FEE = 1200;

// Hoy NO estamos cobrando fee al vendedor (el vendedor recibe el precio publicado).
// Lo dejo acá para compatibilidad por si después lo activas.
export const DEFAULT_SELLER_RATE = 0;

export function formatPrice(amount, currency = "CLP") {
  const n = Number(amount) || 0;
  try {
    return new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `$${Math.round(n)}`;
  }
}

function roundClp(n) {
  return Math.round(Number(n) || 0);
}

function computePlatformFee(price, { platformRate = DEFAULT_PLATFORM_RATE, minPlatformFee = DEFAULT_MIN_PLATFORM_FEE } = {}) {
  const p = roundClp(price);
  if (!p || p <= 0) return 0;

  const pct = roundClp(p * platformRate);
  return Math.max(pct, roundClp(minPlatformFee));
}

/**
 * getFeeRatesForTier: se mantiene por compatibilidad, pero actualmente
 * la regla de negocio NO depende del tier.
 */
export function getFeeRatesForTier(_sellerTier) {
  return {
    platformRate: DEFAULT_PLATFORM_RATE,
    minPlatformFee: DEFAULT_MIN_PLATFORM_FEE,
    sellerRate: DEFAULT_SELLER_RATE,
  };
}

/**
 * getFees: API estable para calcular fees con overrides opcionales.
 * opts: { platformRate?, minPlatformFee?, sellerRate? }
 */
export function getFees(ticketPrice, opts = {}) {
  const p = roundClp(ticketPrice);

  const platformRate = typeof opts.platformRate === "number" ? opts.platformRate : DEFAULT_PLATFORM_RATE;
  const minPlatformFee = typeof opts.minPlatformFee === "number" ? opts.minPlatformFee : DEFAULT_MIN_PLATFORM_FEE;
  const sellerRate = typeof opts.sellerRate === "number" ? opts.sellerRate : DEFAULT_SELLER_RATE;

  const platformFee = computePlatformFee(p, { platformRate, minPlatformFee });

  // sellerFee hoy es 0 (compatibilidad)
  const sellerFee = Math.max(0, roundClp(p * sellerRate));

  return {
    ticketPrice: p,
    platformRate,
    minPlatformFee,
    platformFee,
    sellerRate,
    sellerFee,
  };
}

/**
 * calculateSellerFee / calculateSellerPayout:
 * Se mantienen porque existen imports en el proyecto.
 * OJO: hoy el “Cargo TixSwap” se cobra al comprador, no al vendedor.
 */
export function calculateSellerFee(ticketPrice, _sellerTierOrRole) {
  // Por compatibilidad histórica (antes se usaba como “platformFee”)
  const p = roundClp(ticketPrice);
  return computePlatformFee(p);
}

export function calculateSellerPayout(ticketPrice, _sellerTierOrRole) {
  // Si el cargo lo paga el comprador, el vendedor recibe el precio completo.
  const p = roundClp(ticketPrice);
  return Math.max(0, p);
}

/**
 * calculateFees: lo que usa checkout.
 * Retorna: platformFee y totalDue (precio + fee).
 */
export function calculateFees(ticketPrice, options = {}) {
  const p = roundClp(ticketPrice);
  const fees = getFees(p, options);

  const totalDue = roundClp(p + fees.platformFee);

  return {
    ticketPrice: p,
    platformFee: fees.platformFee,
    totalDue,
    // extras por si los querís mostrar en UI
    platformRate: fees.platformRate,
    minPlatformFee: fees.minPlatformFee,
  };
}

export function calculateTotalPrice(ticketPrice, options = {}) {
  return calculateFees(ticketPrice, options).totalDue;
}

/**
 * Si alguna vez recibes un “total” y quieres inferir el fee,
 * (no recomendable), lo dejo como helper.
 */
export function platformFeeFromTotalPrice(ticketPrice, totalPaid, options = {}) {
  const p = roundClp(ticketPrice);
  const t = roundClp(totalPaid);
  const fees = calculateFees(p, options);
  // Si totalPaid viene raro, preferimos el fee calculado.
  const inferred = Math.max(0, t - p);
  return Math.max(inferred, fees.platformFee);
}

