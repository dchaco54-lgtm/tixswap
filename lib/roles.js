// lib/roles.js - Simplificado a 3 tipos de usuario
// user_type: free | standard | admin

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

// Compatibilidad retroactiva (ROLES)
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

export function canUserSell(userType) {
  const normalized = normalizeRole(userType);
  return USER_TYPE_DEFS[normalized]?.canSell || false;
}

export function getUserCommissionPercent(userType) {
  const normalized = normalizeRole(userType);
  if (normalized === USER_TYPES.STANDARD) return 0.025;
  return 0;
}
