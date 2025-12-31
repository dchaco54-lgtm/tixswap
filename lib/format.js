// lib/format.js

/**
 * Formatea montos a CLP (Chile) sin decimales.
 * Acepta number o string numérico.
 */
export function formatCLP(value) {
  const n = Number(value ?? 0);
  if (Number.isNaN(n)) return "$0";
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(n);
}

/**
 * Formatea números genéricos.
 */
export function formatNumber(value, locale = "es-CL") {
  const n = Number(value ?? 0);
  if (Number.isNaN(n)) return "0";
  return new Intl.NumberFormat(locale).format(n);
}

/**
 * Formatea fecha (solo fecha).
 */
export function formatDate(value, locale = "es-CL") {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "long",
    day: "2-digit",
  }).format(d);
}

/**
 * Formatea fecha + hora.
 */
export function formatDateTime(value, locale = "es-CL") {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

// Por si en alguna parte lo usas como default:
export default {
  formatCLP,
  formatNumber,
  formatDate,
  formatDateTime,
};
