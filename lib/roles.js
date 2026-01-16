// lib/roles.js

/* =========================================================
   Roles base
========================================================= */

export const ROLES = {
  ADMIN: "admin",
  SELLER: "seller",
  BUYER: "buyer",
};

/* =========================================================
   Definición de roles (UI / permisos)
========================================================= */

export const ROLE_DEFS = {
  [ROLES.ADMIN]: {
    label: "Administrador",
  },
  [ROLES.SELLER]: {
    label: "Vendedor",
  },
  [ROLES.BUYER]: {
    label: "Comprador",
  },
};

/* =========================================================
   Orden lógico de roles (tablas / dashboard)
========================================================= */

export const ROLE_ORDER = [
  ROLES.ADMIN,
  ROLES.SELLER,
  ROLES.BUYER,
];

/* =========================================================
   Opciones para selects
========================================================= */

export const ROLE_OPTIONS = ROLE_ORDER.map((role) => ({
  value: role,
  label: ROLE_DEFS[role]?.label || role,
}));

/* =========================================================
   Comisión TixSwap (regla de negocio)
========================================================= */

export const COMMISSION_RATE = 0.025; // 2,5%

export function sellerCommission(amount) {
  return Math.round(amount * COMMISSION_RATE);
}

export function buyerCommission(amount) {
  return Math.round(amount * COMMISSION_RATE);
}

/* =========================================================
   Helpers
========================================================= */

export function normalizeRole(role) {
  if (!role) return ROLES.BUYER;

  const r = String(role).toLowerCase();

  if (r === "admin") return ROLES.ADMIN;
  if (r === "seller" || r === "vendor") return ROLES.SELLER;
  if (r === "buyer" || r === "user") return ROLES.BUYER;

  return ROLES.BUYER;
}

export function roleLabel(role) {
  const normalized = normalizeRole(role);
  return ROLE_DEFS[normalized]?.label || "Desconocido";
}

export function roleCommissionLabel(role) {
  const normalized = normalizeRole(role);

  if (normalized === ROLES.SELLER) {
    return "Vendedor (2,5% comisión)";
  }

  if (normalized === ROLES.BUYER) {
    return "Comprador (2,5% comisión)";
  }

  if (normalized === ROLES.ADMIN) {
    return "Administrador";
  }

  return "—";
}


