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
  export const USER_TYPES = {
    FREE: 'free',
    STANDARD: 'standard',
    ADMIN: 'admin',
  };

  export const USER_TYPE_DEFS = {
    [USER_TYPES.FREE]: {
      label: 'Gratis',
      description: 'Sin permisos de venta',
      canSell: false,
    },
    [USER_TYPES.STANDARD]: {
      label: 'Estándar',
      description: 'Usuario regular con permisos de venta',
      canSell: true,
    },
    [USER_TYPES.ADMIN]: {
      label: 'Administrador',
      description: 'Acceso total al sistema',
      canSell: false,
    },
  };

  // Compatibilidad retroactiva
  export const ROLES = USER_TYPES;
  export const ROLE_DEFS = USER_TYPE_DEFS;
  export const ROLE_ORDER = [USER_TYPES.STANDARD, USER_TYPES.ADMIN];

  export function normalizeRole(userType) {
    if (!userType) return USER_TYPES.FREE;
    const t = String(userType).toLowerCase().trim();
    if (t === 'admin') return USER_TYPES.ADMIN;
    if (t === 'free') return USER_TYPES.FREE;
    return USER_TYPES.STANDARD;
  }

  export function roleLabel(userType) {
    const normalized = normalizeRole(userType);
    return USER_TYPE_DEFS[normalized]?.label || 'Estándar';
  }

  export function roleCommissionLabel(userType) {
    const normalized = normalizeRole(userType);
    if (normalized === USER_TYPES.ADMIN) return 'Administrador';
    if (normalized === USER_TYPES.FREE) return 'Gratis (sin venta)';
    return 'Estándar (2.5% comisión)';
  }
  return ROLES.BASIC;
