// lib/format.js
export function parseCLP(value) {
  // number directo
  if (typeof value === "number") {
    return Number.isFinite(value) ? Math.round(value) : 0;
  }

  if (value == null) return 0;

  // string: "$20.000", "20.000 CLP", "20000", etc.
  const digits = String(value).replace(/[^0-9]/g, "");
  const n = Number(digits);
  return Number.isFinite(n) ? n : 0;
}

export function formatCLP(value) {
  const n = parseCLP(value);
  return n.toLocaleString("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  });
}
