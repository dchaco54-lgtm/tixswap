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

const COMMON_PASSWORDS = new Set([
  "123123",
  "123321",
  "123456",
  "1234567",
  "12345678",
  "123456789",
  "1234567890",
  "654321",
  "987654321",
  "000000",
  "00000000",
  "111111",
  "11111111",
  "121212",
  "222222",
  "333333",
  "444444",
  "555555",
  "666666",
  "777777",
  "888888",
  "999999",
  "112233",
  "159753",
  "147258369",
  "abc123",
  "abc12345",
  "qwerty",
  "qwerty123",
  "qwertyuiop",
  "asdfgh",
  "zxcvbnm",
  "pass",
  "password",
  "password1",
  "passw0rd",
  "p@ssw0rd",
  "letmein",
  "welcome",
  "welcome1",
  "iloveyou",
  "loveyou",
  "admin",
  "admin123",
  "administrator",
  "root",
  "toor",
  "guest",
  "changeme",
  "default",
  "dragon",
  "monkey",
  "baseball",
  "football",
  "soccer",
  "superman",
  "batman",
  "starwars",
  "pokemon",
  "michelle",
  "jessica",
  "charlie",
  "andrew",
  "daniel",
  "master",
  "shadow",
  "sunshine",
  "princess",
  "whatever",
  "freedom",
  "trustno1",
  "hello123",
  "hola123",
  "holahola",
  "hola2024",
  "hola2025",
  "hola2026",
  "teamo",
  "amor123",
  "corazon",
  "corazon123",
  "contraseña",
  "contrasena",
  "contrasena123",
  "contraseña123",
  "clave",
  "clave123",
  "clave2024",
  "clave2025",
  "clave2026",
  "secreto",
  "secreto123",
  "password123",
  "password2024",
  "password2025",
  "password2026",
  "admin2024",
  "admin2025",
  "admin2026",
  "chile",
  "chile123",
  "chile2024",
  "chile2025",
  "chile2026",
  "santiago",
  "santiago123",
  "valparaiso",
  "concepcion",
  "montevideo",
  "uruguay",
  "argentina",
  "peru",
  "colombia",
  "mexico",
  "brasil",
  "brasil123",
  "rio2024",
  "senha",
  "senha123",
  "senha2024",
  "senha2025",
  "senha2026",
  "senhasegura",
  "meuamor",
  "brasileiro",
  "flamengo",
  "palmeiras",
  "corinthians",
  "vasco",
  "internet",
  "linkedin",
  "facebook",
  "instagram",
  "google",
  "youtube",
  "tixswap",
  "tixswap123",
  "tixswap.cl",
  "tixswap2024",
  "tixswap2025",
  "tixswap2026",
  "tixswap2027",
]);

export function normalizePasswordForChecks(password = "") {
  return String(password || "").trim().toLowerCase();
}

export function isCommonPassword(password = "") {
  const normalized = normalizePasswordForChecks(password);
  if (!normalized) return false;
  return COMMON_PASSWORDS.has(normalized);
}

export function containsBrandPassword(password = "") {
  const normalized = normalizePasswordForChecks(password);
  if (!normalized) return false;

  if (normalized.includes("tixswap") || normalized.includes("tixswap.cl")) {
    return true;
  }

  const compact = normalized.replace(/[^a-z0-9]/g, "");
  return compact.includes("tixswap");
}

export function validatePasswordStrength(password = "", opts = {}) {
  const value = String(password || "");

  const checks = {
    minLen: value.length >= 10,
    maxLen: value.length <= 72,
    hasUpper: /[A-Z]/.test(value),
    hasLower: /[a-z]/.test(value),
    hasNumber: /\d/.test(value),
    hasSpecial: /[^A-Za-z0-9\s]/.test(value),
    noSpaces: !/\s/.test(value),
    notCommon: value.length > 0 ? !isCommonPassword(value) : false,
    notBrand: value.length > 0 ? !containsBrandPassword(value) : false,
  };

  const valid = Object.values(checks).every(Boolean);

  let message;
  if (!valid) {
    if (!checks.notBrand) {
      message = opts.brandMessage || "No uses 'tixswap' dentro de tu contraseña.";
    } else if (!checks.notCommon) {
      message = opts.commonMessage || "Esa contraseña es muy común. Elige una más única.";
    } else {
      message =
        opts.defaultMessage ||
        "Debe tener mínimo 10 caracteres e incluir mayúscula, minúscula, número y caracter especial. Evita espacios y claves comunes.";
    }
  }

  return {
    valid,
    message,
    checks,
  };
}

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
