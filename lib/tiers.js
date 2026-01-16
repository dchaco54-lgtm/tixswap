// lib/tiers.js
// Tiers/Categorías para GAMIFICACIÓN (independiente de role/comisiones)

export const TIERS = {
  BASIC: "basic",
  PRO: "pro",
  PREMIUM: "premium",
};

export const TIER_DEFS = {
  [TIERS.BASIC]: {
    label: "Basic",
    color: "gray",
    minSales: 0,
    benefits: [
      "Publicar entradas",
      "Soporte estándar",
    ],
  },
  [TIERS.PRO]: {
    label: "Pro",
    color: "blue",
    minSales: 10,
    benefits: [
      "Todo de Basic",
      "Prioridad en búsquedas",
      "Badge PRO en perfil",
      "Soporte prioritario",
    ],
  },
  [TIERS.PREMIUM]: {
    label: "Premium",
    color: "gold",
    minSales: 50,
    benefits: [
      "Todo de Pro",
      "Destacado en listados",
      "Badge PREMIUM en perfil",
      "Soporte VIP",
      "Estadísticas avanzadas",
    ],
  },
};

export const TIER_ORDER = [TIERS.BASIC, TIERS.PRO, TIERS.PREMIUM];

export const TIER_OPTIONS = TIER_ORDER.map((tier) => ({
  value: tier,
  label: TIER_DEFS[tier]?.label || tier,
}));

// Calcular tier según ventas exitosas
export function calculateTierByStats(stats) {
  const { successfulSales = 0 } = stats || {};
  
  if (successfulSales >= TIER_DEFS[TIERS.PREMIUM].minSales) {
    return TIERS.PREMIUM;
  }
  
  if (successfulSales >= TIER_DEFS[TIERS.PRO].minSales) {
    return TIERS.PRO;
  }
  
  return TIERS.BASIC;
}

export function normalizeTier(tier) {
  if (!tier) return TIERS.BASIC;
  const t = String(tier).toLowerCase();
  if (t === "premium") return TIERS.PREMIUM;
  if (t === "pro") return TIERS.PRO;
  return TIERS.BASIC;
}

export function tierLabel(tier) {
  const normalized = normalizeTier(tier);
  return TIER_DEFS[normalized]?.label || "Basic";
}

export function tierBadge(tier) {
  const normalized = normalizeTier(tier);
  const def = TIER_DEFS[normalized];
  
  if (!def) return null;
  
  return {
    label: def.label,
    color: def.color,
  };
}
