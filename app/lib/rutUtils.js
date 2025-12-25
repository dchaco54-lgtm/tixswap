// app/lib/rutUtils.js
// Utilidades de RUT (Chile) para validación/normalización.

/**
 * Normaliza un RUT para uso interno: sin puntos, DV en mayúscula y con guion.
 * Ej: "17.684.316-0" -> "17684316-0"
 */
export function normalizeRut(input = "") {
  const raw = String(input)
    .trim()
    .toUpperCase()
    .replace(/[^0-9K]/g, "");

  if (!raw) return "";
  if (raw.length < 2) return raw;

  const body = raw.slice(0, -1);
  const dv = raw.slice(-1);

  return `${body}-${dv}`;
}

/** Calcula DV para el cuerpo numérico */
export function calcRutDv(bodyDigits = "") {
  const body = String(bodyDigits).replace(/[^0-9]/g, "");
  if (!body) return "";

  let sum = 0;
  let multiplier = 2;

  for (let i = body.length - 1; i >= 0; i--) {
    sum += Number(body[i]) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }

  const mod = sum % 11;
  const dvCalc = 11 - mod;

  if (dvCalc === 11) return "0";
  if (dvCalc === 10) return "K";
  return String(dvCalc);
}

export function isValidRut(input = "") {
  const norm = normalizeRut(input);
  if (!norm.includes("-")) return false;

  const [body, dv] = norm.split("-");
  if (!body || !dv) return false;
  if (!/^\d+$/.test(body)) return false;

  const expected = calcRutDv(body);
  return expected === dv.toUpperCase();
}

/** Formatea bonito: 17684316-0 -> 17.684.316-0 */
export function formatRut(input = "") {
  const norm = normalizeRut(input);
  if (!norm.includes("-")) return input;

  const [body, dv] = norm.split("-");
  const reversed = body.split("").reverse().join("");
  const withDots = reversed.replace(/(\d{3})(?=\d)/g, "$1.").split("").reverse().join("");
  return `${withDots}-${dv}`;
}
