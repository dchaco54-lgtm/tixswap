export const DEFAULT_PLATFORM_RATE = 0.025;
export const DEFAULT_MIN_PLATFORM_FEE = 1200;
export const DEFAULT_SELLER_RATE = 0;
/**
 * Legacy helper used by some API routes.
 * Computes buyer fee and total amount to charge (CLP).
 * @param {number|string} amount - Ticket price
 * @param {{buyerRate?: number, buyerMin?: number}} opts
 * @returns {{feeAmount: number, totalAmount: number}}
 */
export function getFees(amount, opts = {}) {
  const n = Number(amount);
  const base = Number.isFinite(n) ? Math.round(n) : 0;

  const buyerRate = typeof opts.buyerRate === 'number' ? opts.buyerRate : DEFAULT_PLATFORM_RATE;
  const buyerMin = typeof opts.buyerMin === 'number' ? opts.buyerMin : DEFAULT_MIN_PLATFORM_FEE;

  const feeAmount = Math.max(buyerMin, Math.round(base * buyerRate));
  return { feeAmount, totalAmount: base + feeAmount };
}

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

