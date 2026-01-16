// lib/roles.js
// Roles para COMISIONES (independiente de tier/categoría)

export const ROLES = {
  ADMIN: "admin",
  BASIC: "basic",
  FREE: "free",
};

export const ROLE_DEFS = {
  [ROLES.ADMIN]: {
    label: "Administrador",
    commission: 0,
    description: "Sin comisión - Acceso total",
  },
  [ROLES.FREE]: {
    label: "Usuario Free",
    commission: 0,
    description: "Sin comisión - Usuario promocional",
  },
  [ROLES.BASIC]: {
    label: "Usuario Básico",
    commission: 0.025,
    description: "2.5% con mínimo $1.200",
  },
};

export const ROLE_ORDER = [ROLES.ADMIN, ROLES.FREE, ROLES.BASIC];

export const ROLE_OPTIONS = ROLE_ORDER.map((role) => ({
  value: role,
  label: ROLE_DEFS[role]?.label || role,
}));

// Comisión base
export const COMMISSION_RATE = 0.025; // 2.5%
export const MIN_COMMISSION = 1200; // Mínimo $1.200

export function calculateCommission(amount, role = 'basic') {
  const normalizedRole = String(role || '').toLowerCase();
  
  // Admin y Free: sin comisión
  if (normalizedRole === 'admin' || normalizedRole === 'free') {
    return 0;
  }
  
  // Usuario básico: 2.5% con mínimo $1.200
  const rawFee = Math.round(amount * COMMISSION_RATE);
  return Math.max(rawFee, MIN_COMMISSION);
}

export function normalizeRole(role) {
  if (!role) return ROLES.BASIC;
  const r = String(role).toLowerCase();
  if (r === "admin") return ROLES.ADMIN;
  if (r === "free") return ROLES.FREE;
  return ROLES.BASIC;
}

export function roleLabel(role) {
  const normalized = normalizeRole(role);
  return ROLE_DEFS[normalized]?.label || "Usuario Básico";
}
