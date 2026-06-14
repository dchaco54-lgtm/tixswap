import { getTierCommissionPercent, normalizeTier, TIERS } from "../tiers.js";

export function normalizeClpAmount(value) {
  if (value === null || value === undefined || value === "") return null;

  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    return Math.round(value);
  }

  const normalized = String(value).trim().replace(/[^\d.-]/g, "");
  if (!normalized) return null;

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return null;

  return Math.round(parsed);
}

export function calculateWebpayOrderAmounts({
  ticketPrice,
  sellerTier = TIERS.BASIC,
}) {
  const ticketAmountClp = normalizeClpAmount(ticketPrice);

  if (!Number.isInteger(ticketAmountClp) || ticketAmountClp <= 0) {
    throw new Error("Monto de ticket invalido para Webpay.");
  }

  const normalizedTier = normalizeTier(sellerTier || TIERS.BASIC);
  const commissionRate = getTierCommissionPercent(normalizedTier);
  const feeAmountClp = Math.round(ticketAmountClp * commissionRate);
  const totalAmountClp = ticketAmountClp + feeAmountClp;

  return {
    ticketAmountClp,
    feeAmountClp,
    totalAmountClp,
    sellerTier: normalizedTier,
    commissionRate,
  };
}

export function buildWebpayCheckoutFees({ ticketPrice, sellerTier = TIERS.BASIC }) {
  const amounts = calculateWebpayOrderAmounts({ ticketPrice, sellerTier });

  return {
    ticketPrice: amounts.ticketAmountClp,
    platformFee: amounts.feeAmountClp,
    totalDue: amounts.totalAmountClp,
    sellerTier: amounts.sellerTier,
    commissionRate: amounts.commissionRate,
  };
}

export function getExpectedWebpayOrderAmount(order) {
  const preferredTotal = normalizeClpAmount(order?.total_clp);
  if (Number.isInteger(preferredTotal) && preferredTotal > 0) {
    return preferredTotal;
  }

  const legacyTotal = normalizeClpAmount(order?.total_amount);
  if (Number.isInteger(legacyTotal) && legacyTotal > 0) {
    return legacyTotal;
  }

  const amountClp = normalizeClpAmount(order?.amount_clp);
  const feeClp = normalizeClpAmount(order?.fee_clp) ?? 0;

  if (Number.isInteger(amountClp) && amountClp > 0) {
    return amountClp + feeClp;
  }

  const amount = normalizeClpAmount(order?.amount);
  if (Number.isInteger(amount) && amount > 0) {
    return amount + feeClp;
  }

  return null;
}

export function buildExpectedWebpayOrderAmounts(order) {
  const expectedAmountClp = getExpectedWebpayOrderAmount(order);
  const ticketAmountClp =
    normalizeClpAmount(order?.amount_clp) ??
    normalizeClpAmount(order?.amount) ??
    null;
  const feeAmountClp = normalizeClpAmount(order?.fee_clp) ?? null;

  return {
    expectedAmountClp,
    ticketAmountClp,
    feeAmountClp,
    currency: String(order?.currency || "CLP").trim().toUpperCase() || "CLP",
  };
}
