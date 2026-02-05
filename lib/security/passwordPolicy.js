export const PASSWORD_POLICY = Object.freeze({
  MIN_LEN: 10,
  MAX_LEN: 72,
});

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
  "contrasena",
  "contrasena123",
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
    minLen: value.length >= PASSWORD_POLICY.MIN_LEN,
    maxLen: value.length <= PASSWORD_POLICY.MAX_LEN,
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
      message = opts.brandMessage || "No uses 'tixswap' dentro de tu contrasena.";
    } else if (!checks.notCommon) {
      message = opts.commonMessage || "Esa contrasena es muy comun. Elige una mas unica.";
    } else {
      message =
        opts.defaultMessage ||
        `Debe tener minimo ${PASSWORD_POLICY.MIN_LEN} caracteres e incluir mayuscula, minuscula, numero y caracter especial. Evita espacios y claves comunes.`;
    }
  }

  return {
    valid,
    message,
    checks,
  };
}
