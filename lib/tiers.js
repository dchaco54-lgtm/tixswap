// lib/tiers.js - Simplificado a 3 seller_tier
// seller_tier: basic | pro | elite

export const TIERS = {
  BASIC: 'basic',
  PRO: 'pro',
  ELITE: 'elite',
};

export const TIER_DEFS = {
  [TIERS.BASIC]: {
    label: 'Básico',
    color: 'slate',
    minSales: 0,
    commission: 0.035,
  },
  [TIERS.PRO]: {
    label: 'Pro',
    color: 'blue',
    minSales: 50,
    commission: 0.03,
  },
  [TIERS.ELITE]: {
    label: 'Elite',
    color: 'amber',
    minSales: 200,
    commission: 0.025,
  },
};

export const TIER_ORDER = [TIERS.BASIC, TIERS.PRO, TIERS.ELITE];

export const TIER_OPTIONS = TIER_ORDER.map((tier) => ({
  value: tier,
  label: TIER_DEFS[tier]?.label || tier,
}));

export function normalizeTier(tier) {
  if (!tier) return TIERS.BASIC;
  const t = String(tier).toLowerCase().trim();
  if (t === 'pro') return TIERS.PRO;
  if (t === 'elite') return TIERS.ELITE;
  return TIERS.BASIC;
}

export function tierLabel(tier) {
  const normalized = normalizeTier(tier);
  return TIER_DEFS[normalized]?.label || 'Básico';
}

export function tierBadge(tier) {
  const normalized = normalizeTier(tier);
  const def = TIER_DEFS[normalized];
  return {
    label: def?.label || 'Básico',
    color: def?.color || 'slate',
  };
}

export function calculateTierByStats(stats = {}) {
  const successfulSales = Number(stats.successfulSales || 0);
  if (successfulSales >= TIER_DEFS[TIERS.ELITE].minSales) return TIERS.ELITE;
  if (successfulSales >= TIER_DEFS[TIERS.PRO].minSales) return TIERS.PRO;
  return TIERS.BASIC;
}

export function getTierCommissionPercent(tier) {
  const normalized = normalizeTier(tier);
  return TIER_DEFS[normalized]?.commission ?? 0.035;
}
