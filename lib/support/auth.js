import { supabaseAdmin } from "@/lib/supabaseAdmin";

const ENV_ADMIN_EMAILS = String(process.env.ADMIN_EMAILS || "")
  .split(",")
  .map((email) => String(email || "").trim().toLowerCase())
  .filter(Boolean);

const ADMIN_EMAILS = new Set([
  "davidchacon_17@hotmail.com",
  "soporte@tixswap.cl",
  ...ENV_ADMIN_EMAILS,
]);

function normalizeRole(value) {
  return String(value || "").toLowerCase().trim();
}

export function getSupabaseAdmin() {
  return supabaseAdmin();
}

export async function getUserFromBearer(req, admin) {
  const supabase = admin || supabaseAdmin();
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : authHeader.trim();

  if (!token) return { user: null, error: "UNAUTHORIZED", supabase };

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) {
    return { user: null, error: "UNAUTHORIZED", supabase };
  }

  return { user: data.user, error: null, supabase };
}

export async function getProfileForUser(admin, userId) {
  if (!admin || !userId) return null;
  const { data } = await admin
    .from("profiles")
    .select("id, role, app_role, user_type, email, full_name, rut")
    .eq("id", userId)
    .maybeSingle();
  return data || null;
}

export async function isAdminUser(admin, user) {
  if (!admin || !user?.id) return { ok: false, profile: null };

  const email = String(user.email || "").toLowerCase().trim();
  if (email && ADMIN_EMAILS.has(email)) {
    return { ok: true, profile: null };
  }

  const profile = await getProfileForUser(admin, user.id);
  if (!profile) return { ok: false, profile: null };

  const role = normalizeRole(profile.role);
  const appRole = normalizeRole(profile.app_role);
  const userType = normalizeRole(profile.user_type);
  if (role === "admin" || appRole === "admin" || userType === "admin") {
    return { ok: true, profile };
  }

  const profileEmail = String(profile.email || "").toLowerCase().trim();
  if (profileEmail && ADMIN_EMAILS.has(profileEmail)) {
    return { ok: true, profile };
  }

  return { ok: false, profile };
}
