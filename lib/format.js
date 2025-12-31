// lib/format.js

/**
 * Formatea a peso chileno (CLP) sin decimales.
 * Ej: 20000 -> "$20.000"
 */
export function formatCLP(value) {
  const num =
    typeof value === "string"
      ? Number(String(value).replace(/[^\d.-]/g, ""))
      : value;

  if (!Number.isFinite(num)) return "$0";

  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(num);
}

/**
 * Formatea número con separador de miles (es-CL).
 * Ej: 1234567 -> "1.234.567"
 */
export function formatNumberCL(value) {
  const num =
    typeof value === "string"
      ? Number(String(value).replace(/[^\d.-]/g, ""))
      : value;

  if (!Number.isFinite(num)) return "0";

  return new Intl.NumberFormat("es-CL", {
    maximumFractionDigits: 0,
  }).format(num);
}

/**
 * Fecha corta tipo "27 feb 2026"
 */
export function formatDateShortCL(dateInput) {
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (Number.isNaN(d.getTime())) return "";

  return new Intl.DateTimeFormat("es-CL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
}

// Por si en alguna parte lo usaste con otro nombre
export const formatPrice = formatCLP;
export const money = formatCLP;

export default {
  formatCLP,
  formatPrice,
  money,
  formatNumberCL,
  formatDateShortCL,
};
