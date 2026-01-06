// lib/roles.js

export const ROLES = {
  ADMIN: "admin",
  SELLER: "seller",
  BUYER: "buyer",
};

export const ROLE_OPTIONS = [
  { value: ROLES.ADMIN, label: "Administrador" },
  { value: ROLES.SELLER, label: "Vendedor" },
  { value: ROLES.BUYER, label: "Comprador" },
];

export function roleLabel(role) {
  return (
    ROLE_OPTIONS.find((r) => r.value === role)?.label || "Desconocido"
  );
}

export function roleCommissionLabel(role) {
  switch (role) {
    case ROLES.SELLER:
      return "Vendedor (cobra comisión)";
    case ROLES.ADMIN:
      return "Administrador (sin comisión)";
    case ROLES.BUYER:
      return "Comprador";
    default:
      return "—";
  }
}

