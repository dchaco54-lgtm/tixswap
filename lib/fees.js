/**
 * Fee helpers used across checkout + payment providers.
 *
 * - Buyer fee ("Cargo TixSwap") defaults to 15% of ticket price.
 * - Seller commission tiers (roles) are kept here too.
 */

// -------- Formatting --------
export function formatPrice(value) {
  const num = Number(value || 0);
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(num);
}

// -------- Buyer fees (what the buyer pays on top) --------

function getBuyerFeeRate() {
  // You can override in Vercel env if you ever need to.
  const raw =
    process.env.NEXT_PUBLIC_BUYER_FEE_RATE ??
    process.env.BUYER_FEE_RATE ??
    process.env.NEXT_PUBLIC_PLATFORM_FEE_RATE ??
    process.env.PLATFORM_FEE_RATE ??
    "0.15";

  const rate = Number(raw);
  if (!Number.isFinite(rate) || rate < 0) return 0.15;
  // Guard rails
  if (rate > 1) return 1;
  return rate;
}

function roundCLP(amount) {
  // CLP has no decimals; Math.round is good enough for now.
  return Math.round(Number(amount || 0));
}

/**
 * Returns the checkout fee breakdown (used by /api/checkout/preview)
 */
export function calculateFees(ticketPrice, rate = getBuyerFeeRate()) {
  const base = roundCLP(ticketPrice);
  const platformFee = roundCLP(base * rate);
  const totalDue = roundCLP(base + platformFee);

  return {
    ticketPrice: base,
    platformFee,
    totalDue,
    rate,
  };
}

/**
 * Returns a compact shape used by payment providers.
 */
export function getFees(ticketPrice, rate = getBuyerFeeRate()) {
  const { platformFee, totalDue } = calculateFees(ticketPrice, rate);
  return {
    buyerFee: platformFee,
    total: totalDue,
  };
}

// -------- Seller commissions (tiers) --------

// Commission rates for seller roles (fraction of ticket price)
const ROLE_RATES = {
  basic: 0.035,
  pro: 0.025,
  premium: 0.015,
  elite: 0.005,
  ultra_premium: 0.0,
};

/**
 * Returns the fee rates for a seller role.
 * This is used when calculating what the seller receives.
 */
export function getFeeRatesForRole(role) {
  const key = String(role || "basic").toLowerCase();
  const sellerCommissionRate = ROLE_RATES[key] ?? ROLE_RATES.basic;
  return {
    sellerCommissionRate,
  };
}
