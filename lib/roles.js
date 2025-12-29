// lib/roles.js
// Roles (beneficios) + tasas de cargo por servicio (comprador/vendedor).
// MVP: 2.0% comprador + 2.0% vendedor (5% total).
// Solo "ultra_premium" (y admin) tienen 0%.

export const ROLE_ORDER = ["basic", "pro", "premium", "elite", "ultra_premium"];

export const ROLE_DEFS = {
  basic: {
    slug: "basic",
    name: "Básico",
    commissionRate: 0.020,
    buyerFeeRate: 0.020,
    sellerFeeRate: 0.020,
    opsRequired: 0,
    minMonths: 0,
    benefits: ["Acceso a compra/venta", "Chat soporte"],
  },
  pro: {
    slug: "pro",
    name: "Pro",
    commissionRate: 0.020,
    buyerFeeRate: 0.020,
    sellerFeeRate: 0.020,
    opsRequired: 20,
    minMonths: 1,
    benefits: ["Acceso a compra/venta", "Mejor priorización soporte (futuro)"],
  },
  premium: {
    slug: "premium",
    name: "Premium",
    commissionRate: 0.020,
    buyerFeeRate: 0.0250,
    sellerFeeRate: 0.020,
    opsRequired: 50,
    minMonths: 2,
    benefits: ["Acceso a compra/venta", "Soporte preferente (futuro)"],
  },
  elite: {
    slug: "elite",
    name: "Elite",
    commissionRate: 0.020,
    buyerFeeRate: 0.020,
    sellerFeeRate: 0.020,
    opsRequired: 100,
    minMonths: 3,
    benefits: ["Acceso a compra/venta", "Beneficios especiales (futuro)"],
  },
  ultra_premium: {
    slug: "ultra_premium",
    name: "Ultra Premium",
    commissionRate: 0.0,
    buyerFeeRate: 0.0,
    sellerFeeRate: 0.0,
    opsRequired: 200,
    minMonths: 6,
    benefits: ["0% cargo por servicio", "Acceso VIP (futuro)"],
  },
};

export function normalizeRole(role) {
  const r = String(role || "").toLowerCase();
  if (r in ROLE_DEFS) return r;
  return "basic";
}

export function getRoleDef(role) {
  const key = normalizeRole(role);
  return ROLE_DEFS[key];
}

export function getFeeRatesFromRole(role) {
  const def = getRoleDef(role);
  return {
    buyerRate: Number(def.buyerFeeRate ?? 0.020),
    sellerRate: Number(def.sellerFeeRate ?? 0.020),
  };
}

