import {
  containsBrandPassword,
  isCommonPassword,
  normalizePasswordForChecks,
  validatePasswordStrength,
} from "@/lib/security/passwordPolicy";

/**
 * Validaciones robustas para registro:
 * - RUT chileno (módulo 11)
 * - Email (estructura básica)
 * - Teléfono chileno (+56)
 */

// ============================================
// RUT CHILENO
// ============================================

/**
 * Calcula dígito verificador usando módulo 11
 * @param {string} numStr - Números sin dígito verificador
 * @returns {string} Dígito verificador (0, 1-9 o K)
 */
function computeDv(numStr = "") {
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

/**
 * Normaliza RUT: "12.345.678-k" => "12345678-K"
 * Acepta: "12345678k", "12.345.678-k", "12345678-K", etc.
 * @param {string} input - RUT en cualquier formato
 * @returns {string} RUT normalizado "12345678-K" o vacío si inválido
 */
export function normalizeRut(input = "") {
  if (!input) return "";

  // Remover puntos y espacios, convertir a mayúscula
  const clean = String(input)
    .replace(/[.\s]/g, "")
    .toUpperCase();

  if (!clean) return "";

  // Si ya tiene guion, separar body y dv
  if (clean.includes("-")) {
    const parts = clean.split("-");
    if (parts.length !== 2) return "";
    const [body, dv] = parts;
    if (!/^\d+$/.test(body) || !/^[0-9K]$/.test(dv)) return "";
    return `${body}-${dv}`;
  }

  // Si no tiene guion, asumir últimos caracteres son el DV
  if (clean.length < 2) return "";

  const body = clean.slice(0, -1);
  const dv = clean.slice(-1);

  if (!/^\d+$/.test(body) || !/^[0-9K]$/.test(dv)) return "";

  return `${body}-${dv}`;
}

/**
 * Valida RUT usando módulo 11
 * @param {string} input - RUT en cualquier formato o normalizado
 * @returns {boolean}
 */
export function isValidRut(input = "") {
  const normalized = normalizeRut(input);
  if (!normalized) return false;

  const [body, dv] = normalized.split("-");
  if (!body || !dv) return false;

  // Validar que body sea solo dígitos y tenga largo razonable
  if (!/^\d+$/.test(body) || body.length < 5 || body.length > 10) {
    return false;
  }

  // Calcular DV esperado
  const expectedDv = computeDv(body);

  return expectedDv === dv;
}

/**
 * Detecta RUTs claramente fraudulentos
 * @param {string} normalized - RUT en formato "12345678-K"
 * @returns {boolean} true si parece fraudulento
 */
export function isSuspiciousRut(normalized = "") {
  if (!normalized) return false;

  const body = normalized.split("-")[0] || "";

  // Todos los dígitos iguales: 11111111, 22222222, etc.
  if (/^(\d)\1+$/.test(body)) {
    return true;
  }

  // Secuencias obvias: 12345678, 87654321, etc.
  const isAscending = /^1234567|^2345678|^3456789/.test(body);
  const isDescending = /8765432|7654321|6543210/.test(body);

  // Solo rechazar si es MUY obvio (primeros 8 dígitos exactos)
  if (body.length === 8) {
    if (isAscending || isDescending) {
      return true;
    }
  }

  return false;
}

// ============================================
// EMAIL
// ============================================

/**
 * Valida email con reglas básicas pero funcionales
 * @param {string} input
 * @returns {boolean}
 */
export function isValidEmail(input = "") {
  const email = String(input).trim().toLowerCase();

  if (!email) return false;

  // No espacios
  if (/\s/.test(email)) return false;

  // Un solo @
  const atCount = (email.match(/@/g) || []).length;
  if (atCount !== 1) return false;

  const [localPart, domain] = email.split("@");

  // Partes no vacías
  if (!localPart || !domain) return false;

  // Dominio tiene al menos un punto
  if (!domain.includes(".")) return false;

  // TLD tiene al menos 2 caracteres
  const tldMatch = domain.match(/\.([a-z0-9]{2,})$/);
  if (!tldMatch) return false;

  // Local part: sin puntos seguidos, sin iniciar/terminar con punto
  if (/\.\./.test(localPart)) return false;
  if (/^\.|\.@/.test(email)) return false;

  // Caracteres válidos básicos
  if (!/^[a-z0-9._+-]+@[a-z0-9.-]+\.[a-z0-9]{2,}$/.test(email)) {
    return false;
  }

  return true;
}

// ============================================
// TELÉFONO CHILENO
// ============================================

/**
 * Normaliza teléfono chileno a formato E.164: "+569XXXXXXXX"
 * Acepta:
 * - 963528995 (solo dígitos)
 * - 56963528995 (con código país sin +)
 * - +56963528995 (E.164 sin espacios)
 * - +56 9 63528995 (E.164 con espacios)
 * @param {string} input
 * @returns {string} "+569XXXXXXXX" o vacío si no es válido
 */
export function normalizePhoneCL(input = "") {
  if (!input) return "";

  // Remover espacios
  let clean = String(input).replace(/\s/g, "");

  // Si inicia con +, remover +
  if (clean.startsWith("+")) {
    clean = clean.slice(1);
  }

  // Solo dígitos ahora
  if (!/^\d+$/.test(clean)) return "";

  let areaCode = "";
  let number = "";

  // Casos:
  // 1. "56963528995" (11 dígitos: 56 + 9 + 8)
  // 2. "963528995" (9 dígitos: 9 + 8)
  // 3. Inválidos: "569XXXXXXX" (10 dígitos sin 9 en posición correcta)

  if (clean.startsWith("56")) {
    areaCode = "56";
    number = clean.slice(2);
  } else {
    areaCode = "56";
    number = clean;
  }

  // number debe ser "9XXXXXXXX" (9 seguido de 8 dígitos)
  if (!/^9\d{8}$/.test(number)) {
    return "";
  }

  return `+${areaCode}${number}`;
}

/**
 * Valida teléfono chileno normalizado
 * @param {string} input - Teléfono en cualquier formato
 * @returns {boolean}
 */
export function isValidPhoneCL(input = "") {
  const normalized = normalizePhoneCL(input);
  if (!normalized) return false;

  // Debe cumplir: +569XXXXXXXX (11 caracteres)
  return normalized.length === 12 && /^\+569\d{8}$/.test(normalized);
}

/**
 * Retorna teléfono normalizado si es válido, o mensaje de error
 * Útil para mostrar en UI
 * @param {string} input
 * @returns {object} { valid: boolean, normalized: string, error?: string }
 */
export function validateAndNormalizePhoneCL(input = "") {
  const normalized = normalizePhoneCL(input);

  if (!normalized) {
    return {
      valid: false,
      normalized: "",
      error: "Teléfono inválido. Debe ser celular chileno: +56 9XXXXXXXX",
    };
  }

  if (!isValidPhoneCL(normalized)) {
    return {
      valid: false,
      normalized: "",
      error: "Teléfono inválido. Debe ser celular chileno: +56 9XXXXXXXX",
    };
  }

  return {
    valid: true,
    normalized,
    error: null,
  };
}

// ============================================
// PASSWORD
// ============================================

export {
  containsBrandPassword,
  isCommonPassword,
  normalizePasswordForChecks,
  validatePasswordStrength,
};

// ============================================
// FORMULARIO COMPLETO
// ============================================

/**
 * Valida todos los campos del registro
 * @param {object} fields - { fullName, rut, email, phone, password, confirmPassword }
 * @returns {object} { valid: boolean, errors: { field: string } }
 */
export function validateRegisterForm({
  fullName = "",
  rut = "",
  email = "",
  phone = "",
  password = "",
  confirmPassword = "",
  acceptedTerms = false,
} = {}) {
  const errors = {};

  // Nombre
  if (!fullName.trim()) {
    errors.fullName = "Debes ingresar tu nombre";
  }

  // RUT
  if (!rut.trim()) {
    errors.rut = "Debes ingresar tu RUT";
  } else if (!isValidRut(rut)) {
    errors.rut = "RUT inválido. Revisa el formato y dígito verificador";
  } else if (isSuspiciousRut(normalizeRut(rut))) {
    errors.rut = "RUT no válido por razones de seguridad";
  }

  // Email
  if (!email.trim()) {
    errors.email = "Debes ingresar un correo";
  } else if (!isValidEmail(email)) {
    errors.email = "Correo inválido. Ej: nombre@dominio.cl";
  }

  // Teléfono
  if (!phone.trim()) {
    errors.phone = "Debes ingresar un teléfono";
  } else if (!isValidPhoneCL(phone)) {
    errors.phone = "Teléfono inválido. Debe ser celular chileno: +56 9XXXXXXXX";
  }

  // Contraseñas
  if (!password) {
    errors.password = "Debes ingresar una contraseña";
  } else {
    const passwordStrength = validatePasswordStrength(password);
    if (!passwordStrength.valid) {
      errors.password = passwordStrength.message;
    }
  }

  if (!confirmPassword) {
    errors.confirmPassword = "Debes confirmar la contraseña";
  } else if (password !== confirmPassword) {
    errors.confirmPassword = "Las contraseñas no coinciden";
  }

  // Términos
  if (!acceptedTerms) {
    errors.terms = "Debes aceptar los Términos y Condiciones";
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Normaliza datos listos para enviar a Supabase
 * @param {object} data - { fullName, rut, email, phone }
 * @returns {object} Datos normalizados
 */
export function normalizeFormData({
  fullName = "",
  rut = "",
  email = "",
  phone = "",
} = {}) {
  return {
    fullName: fullName.trim(),
    rut: normalizeRut(rut),
    email: email.trim().toLowerCase(),
    phone: normalizePhoneCL(phone),
  };
}
