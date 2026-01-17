// lib/tiers.js
// Tiers/Categorías para GAMIFICACIÓN (independiente de role/comisiones)

export const TIERS = {
  FREE: "free",
  BASIC: "basic",
  PRO: "pro",
  PREMIUM: "premium",
  ELITE: "elite",
};

// Nota: beneficios y colores son informativos (UI). No afectan pagos.
export const TIER_DEFS = {
  [TIERS.FREE]: {
    label: "Free",
    color: "slate",
    minSales: 0,
    benefits: ["Segmento fijado por admin", "Sin recálculo automático"],
  },
  [TIERS.BASIC]: {
    label: "Básico",
    color: "gray",
    minSales: 0,
    benefits: ["Publicar entradas", "Soporte estándar"],
  },
  [TIERS.PRO]: {
    label: "Pro",
    color: "blue",
    minSales: 10,
    benefits: [
      "Todo de Básico",
      "Prioridad en búsquedas",
      "Badge PRO en perfil",
      "Soporte prioritario",
    ],
  },
  [TIERS.PREMIUM]: {
    label: "Premium",
    color: "amber",
    minSales: 50,
    benefits: [
      "Todo de Pro",
      "Destacado en listados",
      "Badge PREMIUM en perfil",
      "Soporte VIP",
      "Estadísticas avanzadas",
    ],
  },
  [TIERS.ELITE]: {
    label: "Elite",
    color: "emerald",
    minSales: 200,
    benefits: [
      "Todo de Premium",
      "Visibilidad máxima",
      "Revisión manual / invitación",
    ],
  },
};

// Orden para progresión automática (excluye FREE, que se fija manualmente)
export const TIER_ORDER = [TIERS.BASIC, TIERS.PRO, TIERS.PREMIUM, TIERS.ELITE];

export const TIER_OPTIONS = [TIERS.FREE, ...TIER_ORDER].map((tier) => ({
  value: tier,
  label: TIER_DEFS[tier]?.label || tier,
}));

// Calcular tier según ventas exitosas (solo si no está fijado/lock)
export function calculateTierByStats(stats) {
  const { successfulSales = 0 } = stats || {};

  if (successfulSales >= TIER_DEFS[TIERS.ELITE].minSales) return TIERS.ELITE;
  if (successfulSales >= TIER_DEFS[TIERS.PREMIUM].minSales) return TIERS.PREMIUM;
  if (successfulSales >= TIER_DEFS[TIERS.PRO].minSales) return TIERS.PRO;
  return TIERS.BASIC;
}

export function normalizeTier(tier) {
  if (!tier) return TIERS.BASIC;
  const t = String(tier).toLowerCase().trim();
  if (t === "free") return TIERS.FREE;
  if (t === "pro") return TIERS.PRO;
  if (t === "premium") return TIERS.PREMIUM;
  if (t === "elite") return TIERS.ELITE;
  return TIERS.BASIC;
}

export function tierLabel(tier) {
  const normalized = normalizeTier(tier);
  return TIER_DEFS[normalized]?.label || "Básico";
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
