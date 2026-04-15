import { normalizePhoneCL, normalizeRut } from "@/lib/validations";
import {
  getMissingRequiredProfileFields,
  getProfileCompletionState,
  isProfileReadyForSensitiveActions,
} from "@/lib/profileCompletion";

const ALLOWED_PROFILE_STATUSES = new Set(["online", "busy", "away", "invisible"]);
const ALLOWED_USER_TYPES = new Set(["free", "standard", "admin"]);
const ALLOWED_SELLER_TIERS = new Set(["basic", "pro", "elite"]);

function pickMetadataValue(user, keys) {
  for (const key of keys) {
    const value =
      user?.user_metadata?.[key] ??
      user?.app_metadata?.[key] ??
      null;

    if (value !== null && value !== undefined && String(value).trim()) {
      return String(value).trim();
    }
  }

  return null;
}

function normalizeAllowedValue(value, allowedValues, fallback) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();

  if (allowedValues.has(normalized)) {
    return normalized;
  }

  return fallback;
}

function buildSeedProfile(user) {
  const fullName = pickMetadataValue(user, ["full_name", "name", "fullName"]);
  const rutRaw = pickMetadataValue(user, ["rut"]);
  const phoneRaw = pickMetadataValue(user, ["phone", "phone_number"]);
  const normalizedRut = normalizeRut(rutRaw || "");
  const normalizedPhone = normalizePhoneCL(phoneRaw || "");
  const hasRequiredFields = Boolean(fullName && normalizedRut && normalizedPhone);
  const userType = normalizeAllowedValue(
    pickMetadataValue(user, ["user_type", "role"]),
    ALLOWED_USER_TYPES,
    "standard"
  );
  const sellerTier = normalizeAllowedValue(
    pickMetadataValue(user, ["seller_tier"]),
    ALLOWED_SELLER_TIERS,
    "basic"
  );
  const role = pickMetadataValue(user, ["role", "user_type"]) || userType;
  const status = normalizeAllowedValue(
    pickMetadataValue(user, ["status"]),
    ALLOWED_PROFILE_STATUSES,
    "online"
  );

  return {
    id: user.id,
    email: user.email || null,
    full_name: fullName || null,
    rut: normalizedRut || null,
    phone: normalizedPhone || null,
    user_type: userType,
    seller_tier: sellerTier,
    role,
    status,
    seller_tier_locked: false,
    email_confirmed: Boolean(user?.email_confirmed_at || user?.confirmed_at),
    onboarding_completed: hasRequiredFields,
    onboarding_done: hasRequiredFields,
    onboarding_completed_at: hasRequiredFields ? new Date().toISOString() : null,
  };
}

export function buildProfileGatePayload(profile) {
  return {
    profile_state: getProfileCompletionState(profile),
    missing_fields: getMissingRequiredProfileFields(profile),
    profile_complete: isProfileReadyForSensitiveActions(profile),
  };
}

export function buildProfileIncompleteResponse(profile, action) {
  return {
    error: "PROFILE_INCOMPLETE",
    message:
      "Para comprar, vender y participar de forma segura en TixSwap, necesitamos validar algunos datos de tu cuenta.",
    detail: "Esto nos ayuda a proteger a compradores y vendedores.",
    action: action || null,
    ...buildProfileGatePayload(profile),
  };
}

export async function syncProfileFromAuthUser(admin, user) {
  const { data: existing, error: fetchError } = await admin
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (fetchError && fetchError.code !== "PGRST116") {
    throw fetchError;
  }

  const seed = buildSeedProfile(user);

  if (!existing) {
    const { data: created, error: insertError } = await admin
      .from("profiles")
      .insert(seed)
      .select("*")
      .single();

    if (insertError) {
      throw insertError;
    }

    return created;
  }

  const patch = {};
  const mergedProfile = { ...existing, ...patch };
  const missingFields = getMissingRequiredProfileFields(mergedProfile);

  if (seed.email && seed.email !== existing.email) patch.email = seed.email;
  if (seed.email_confirmed !== existing.email_confirmed) {
    patch.email_confirmed = seed.email_confirmed;
  }
  if (!existing.full_name && seed.full_name) patch.full_name = seed.full_name;
  if (!existing.rut && seed.rut) patch.rut = seed.rut;
  if (!existing.phone && seed.phone) patch.phone = seed.phone;
  if (!existing.user_type && seed.user_type) patch.user_type = seed.user_type;
  if (!existing.seller_tier && seed.seller_tier) patch.seller_tier = seed.seller_tier;
  if (!existing.role && seed.role) patch.role = seed.role;
  if (!existing.status && seed.status) patch.status = seed.status;
  if (existing.seller_tier_locked === null || existing.seller_tier_locked === undefined) {
    patch.seller_tier_locked = false;
  }

  if (missingFields.length === 0) {
    if (existing.onboarding_completed !== true) patch.onboarding_completed = true;
    if (existing.onboarding_done !== true) patch.onboarding_done = true;
    if (!existing.onboarding_completed_at) {
      patch.onboarding_completed_at = new Date().toISOString();
    }
  } else {
    if (existing.onboarding_completed === null || existing.onboarding_completed === undefined) {
      patch.onboarding_completed = false;
    }
    if (existing.onboarding_done === null || existing.onboarding_done === undefined) {
      patch.onboarding_done = false;
    }
  }

  if (!Object.keys(patch).length) {
    return existing;
  }

  const { data: updated, error: updateError } = await admin
    .from("profiles")
    .update(patch)
    .eq("id", user.id)
    .select("*")
    .single();

  if (updateError) {
    throw updateError;
  }

  return updated;
}
