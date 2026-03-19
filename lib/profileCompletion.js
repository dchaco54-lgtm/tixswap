import {
  isSuspiciousRut,
  isValidPhoneCL,
  isValidRut,
  normalizePhoneCL,
  normalizeRut,
} from "@/lib/validations";

export const PROFILE_COMPLETION_COPY = {
  title: "Para continuar de forma segura",
  message:
    "Para comprar, vender y participar de forma segura en TixSwap, necesitamos validar algunos datos de tu cuenta.",
  helper: "Esto nos ayuda a proteger a compradores y vendedores.",
  cta: "Completar datos",
};

export const REQUIRED_PROFILE_FIELDS = [
  { key: "full_name", label: "Nombre completo" },
  { key: "rut", label: "RUT" },
  { key: "phone", label: "Teléfono" },
];

function hasText(value) {
  return Boolean(String(value ?? "").trim());
}

export function getMissingRequiredProfileFields(profile) {
  const missing = [];

  if (!hasText(profile?.full_name)) missing.push("full_name");
  if (!hasText(profile?.rut)) missing.push("rut");
  if (!hasText(profile?.phone)) missing.push("phone");

  return missing;
}

export function isProfileReadyForSensitiveActions(profile) {
  return getMissingRequiredProfileFields(profile).length === 0;
}

export function getProfileCompletionState(profile) {
  if (!profile?.id) return "auth_user_created";
  if (!isProfileReadyForSensitiveActions(profile)) return "profile_incomplete";
  if (profile?.verified_at) return "profile_verified";
  return "profile_complete";
}

export function normalizeProfileCompletionData(input = {}) {
  return {
    full_name: String(input.full_name || input.fullName || "").trim(),
    rut: normalizeRut(input.rut || ""),
    phone: normalizePhoneCL(input.phone || ""),
  };
}

export function validateProfileCompletionData(input = {}) {
  const normalized = normalizeProfileCompletionData(input);
  const errors = {};

  if (!normalized.full_name) {
    errors.full_name = "Debes ingresar tu nombre completo.";
  }

  if (!normalized.rut) {
    errors.rut = "Debes ingresar tu RUT.";
  } else if (!isValidRut(normalized.rut)) {
    errors.rut = "RUT inválido. Revisa el formato y dígito verificador.";
  } else if (isSuspiciousRut(normalized.rut)) {
    errors.rut = "Ese RUT no pasó la validación de seguridad.";
  }

  if (!normalized.phone) {
    errors.phone = "Debes ingresar tu teléfono.";
  } else if (!isValidPhoneCL(normalized.phone)) {
    errors.phone = "Teléfono inválido. Usa un celular chileno: +56 9XXXXXXXX.";
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    normalized,
  };
}
