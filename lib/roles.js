// lib/roles.js

// Roles y comisiones por plan
export const ROLES = {
  ADMIN: "admin",
  BASIC: "basic", // 3.5%
  FREE: "free", // 0%
  PRO: "pro", // 2.5%
  PREMIUM: "premium", // 1.5%
  ELITE: "elite", // 0.5%
  ULTRA: "ultra", // 0%
};

// Definición UI
export const ROLE_DEFS = {
  [ROLES.ADMIN]: { label: "Administrador" },
  [ROLES.BASIC]: { label: "Básico" },
  [ROLES.FREE]: { label: "Free" },
  [ROLES.PRO]: { label: "Pro" },
  [ROLES.PREMIUM]: { label: "Premium" },
  [ROLES.ELITE]: { label: "Elite" },
  [ROLES.ULTRA]: { label: "Ultra Premium" },
};

// Orden lógico para selects/tablas (de más común a menos)
export const ROLE_ORDER = [
  ROLES.BASIC,
  ROLES.FREE,
  ROLES.PRO,
  ROLES.PREMIUM,
  ROLES.ELITE,
  ROLES.ULTRA,
  ROLES.ADMIN,
];

export const ROLE_OPTIONS = ROLE_ORDER.map((role) => ({
  value: role,
  label: ROLE_DEFS[role]?.label || role,
}));

// Comisiones por rol (por ahora solo usada para labels informativos)
export const ROLE_COMMISSIONS = {
  [ROLES.BASIC]: 0.035,
  [ROLES.FREE]: 0,
  [ROLES.PRO]: 0.025,
  [ROLES.PREMIUM]: 0.015,
  [ROLES.ELITE]: 0.005,
  [ROLES.ULTRA]: 0,
  [ROLES.ADMIN]: 0,
};

// Helpers
export function normalizeRole(role) {
  if (!role) return ROLES.BASIC;
  const r = String(role).toLowerCase();

  if (r === "admin") return ROLES.ADMIN;
  if (r === "free") return ROLES.FREE;
  if (r === "pro") return ROLES.PRO;
  if (r === "premium") return ROLES.PREMIUM;
  if (r === "elite") return ROLES.ELITE;
  if (r === "ultra" || r === "ultra-premium" || r === "ultra premium") return ROLES.ULTRA;

  // Compatibilidad con roles antiguos
  if (r === "basic" || r === "buyer" || r === "user" || r === "seller") return ROLES.BASIC;

  return ROLES.BASIC;
}

export function roleLabel(role) {
  const normalized = normalizeRole(role);
  return ROLE_DEFS[normalized]?.label || "Desconocido";
}

export function roleCommissionLabel(role) {
  const normalized = normalizeRole(role);
  const pct = ROLE_COMMISSIONS[normalized];

  if (normalized === ROLES.ADMIN) return "Administrador";
  if (pct === 0) return `${roleLabel(normalized)} (0% comisión)`;
  if (typeof pct === "number") return `${roleLabel(normalized)} (${(pct * 100).toFixed(1)}% comisión)`;
  return roleLabel(normalized);
}
