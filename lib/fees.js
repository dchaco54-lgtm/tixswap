// Centralized fee logic for TixSwap.
// Business rule (buyer fee):
// - Platform fee is 2.5% of ticket price
// - Minimum platform fee is $1.200 CLP (so we don't lose money on small tickets)
// - Buyer pays: ticket price + platform fee
// - Seller payout: ticket price (minus any seller fee, currently 0)

export const DEFAULT_PLATFORM_RATE = 0.025;
export const DEFAULT_MIN_PLATFORM_FEE = 1200;
export const DEFAULT_SELLER_RATE = 0; // set to >0 if you want a seller-side fee later

export function formatPrice(amount) {
  const n = Number(amount || 0);
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(n);
}

/**
 * Calculate fees for a ticket price (CLP).
 * Returns integers (CLP).
 */
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

  // Buyer pays ticket + platform fee
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

// ---------------------------------------------------------------------------
// Legacy role-based helpers (kept for backwards compatibility)
//
// NOTE: These assume buyer pays only the ticket price (totalDue = totalAmount).
// If you use them, make sure you know which pricing model you're applying.

const feeRatesByRole = {
  basic: { platformRate: 0.05, sellerRate: 0.05 },
  pro: { platformRate: 0.04, sellerRate: 0.04 },
  premium: { platformRate: 0.03, sellerRate: 0.03 },
  elite: { platformRate: 0.025, sellerRate: 0.025 },
  ultra: { platformRate: 0.02, sellerRate: 0.02 },
};

export function getFeeRatesForRole(role = 'basic') {
  return feeRatesByRole[role] || feeRatesByRole.basic;
}

export function calcFees(totalAmount, role = 'basic') {
  const { platformRate, sellerRate } = getFeeRatesForRole(role);

  const total = Number(totalAmount) || 0;
  const platformFee = Math.round(total * platformRate);
  const sellerFee = Math.round(total * sellerRate);

  return {
    platformFee,
    sellerFee,
    sellerPayout: total - sellerFee,
    totalDue: total,
  };
}

export function getFees(totalAmount, role = 'basic') {
  return calcFees(totalAmount, role);
}
