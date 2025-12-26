// lib/rutUtils.js

export function cleanRut(input = "") {
  return String(input).replace(/[^0-9kK]/g, "").toUpperCase();
}

export function computeDv(numStr = "") {
  let sum = 0;
  let mul = 2;

  for (let i = numStr.length - 1; i >= 0; i--) {
    sum += parseInt(numStr[i], 10) * mul;
    mul = mul === 7 ? 2 : mul + 1;
  }

  const mod = 11 - (sum % 11);
  if (mod === 11) return "0";
  if (mod === 10) return "K";
  return String(mod);
}

export function validateRut(input = "") {
  const rut = cleanRut(input);
  if (rut.length < 2) return false;

  const body = rut.slice(0, -1);
  const dv = rut.slice(-1);

  // body tiene que ser solo números
  if (!/^\d+$/.test(body)) return false;

  return computeDv(body) === dv;
}

export function formatRut(input = "") {
  const rut = cleanRut(input);
  if (rut.length <= 1) return rut;

  const body = rut.slice(0, -1);
  const dv = rut.slice(-1);

  let formatted = "";
  let i = body.length;
  while (i > 3) {
    formatted = "." + body.slice(i - 3, i) + formatted;
    i -= 3;
  }
  formatted = body.slice(0, i) + formatted;

  return `${formatted}-${dv}`;
}
