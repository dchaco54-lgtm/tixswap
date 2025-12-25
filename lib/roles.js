// lib/roles.js
// Roles y comisiones de TixSwap (centralizado)

export const ROLE_ORDER = ["basic", "pro", "premium", "elite", "ultra_premium"];

// Definición de roles (por defecto aplica al VENDEDOR; el comprador no paga comisión en esta etapa del MVP)
export const ROLE_DEFS = {
  basic: {
    slug: "basic",
    name: "Básico",
    commissionRate: 0.035,
    opsRequired: 0,
    minMonths: 0,
    next: "pro",
  },
  pro: {
    slug: "pro",
    name: "Pro",
    commissionRate: 0.025,
    opsRequired: 50,
    minMonths: 3,
    next: "premium",
  },
  premium: {
    slug: "premium",
    name: "Premium",
    commissionRate: 0.015,
    opsRequired: 100,
    minMonths: 6,
    next: "elite",
  },
  elite: {
    slug: "elite",
    name: "Elite",
    commissionRate: 0.005,
    opsRequired: 200,
    minMonths: 12,
    next: null,
  },
  ultra_premium: {
    slug: "ultra_premium",
    name: "Ultra Premium",
    commissionRate: 0,
    opsRequired: null, // solo manual/invitación
    minMonths: null,
    next: null,
  },
  admin: {
    slug: "admin",
    name: "Admin",
    commissionRate: 0,
    opsRequired: null,
    minMonths: null,
    next: null,
  },
};

// Mapeo de roles antiguos/legacy a los nuevos
export function normalizeRole(role) {
  if (!role) return "basic";

  const r = String(role).toLowerCase();

  if (r === "admin") return "admin";

  // legacy
  if (r === "user" || r === "standard" || r === "usuario" || r === "general") return "basic";
  if (r === "super_premium" || r === "super-premium" || r === "superpremium") return "ultra_premium";

  // nuevos
  if (r === "basic" || r === "pro" || r === "premium" || r === "elite" || r === "ultra_premium") return r;

  // fallback seguro
  return "basic";
}

export function roleName(role) {
  const r = normalizeRole(role);
  return ROLE_DEFS[r]?.name || "Básico";
}

export function roleCommissionRate(role) {
  const r = normalizeRole(role);
  return ROLE_DEFS[r]?.commissionRate ?? 0.035;
}

export function roleCommissionLabel(role) {
  const r = normalizeRole(role);
  const def = ROLE_DEFS[r];
  if (!def) return "Básico (3,5% comisión)";

  if (r === "admin") return "Administrador TixSwap";
  const pct = (def.commissionRate * 100).toLocaleString("es-CL", {
    minimumFractionDigits: def.commissionRate === 0 ? 0 : 1,
    maximumFractionDigits: 1,
  });

  return `${def.name} (${pct}% comisión)`;
}

// Opciones para <select> en admin
export const ROLE_OPTIONS = [
  { value: "basic", label: roleCommissionLabel("basic") },
  { value: "pro", label: roleCommissionLabel("pro") },
  { value: "premium", label: roleCommissionLabel("premium") },
  { value: "elite", label: roleCommissionLabel("elite") },
  { value: "ultra_premium", label: roleCommissionLabel("ultra_premium") },
  { value: "admin", label: "Admin" },
];

// Reglas de upgrade (operaciones + meses mínimos). Ultra Premium es manual.
export function getUpgradePlan(role) {
  const r = normalizeRole(role);
  const def = ROLE_DEFS[r];

  if (!def) return null;
  if (r === "admin") return { current: "Admin", next: null };
  if (r === "ultra_premium") return { current: "Ultra Premium", next: null, manual: true };

  const nextSlug = def.next;
  if (!nextSlug) return { current: def.name, next: null };

  const nextDef = ROLE_DEFS[nextSlug];
  return {
    current: def.name,
    next: nextDef?.name || null,
    nextSlug,
    nextOpsRequired: nextDef?.opsRequired ?? null,
    nextMinMonths: nextDef?.minMonths ?? null,
  };
}

function monthsBetween(fromDate, toDate) {
  const from = new Date(fromDate);
  const to = new Date(toDate);

  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return 0;

  let months = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
  if (to.getDate() < from.getDate()) months -= 1;
  return Math.max(0, months);
}

export function getUpgradeProgress({ role, operationsCount = 0, userCreatedAt = null, now = new Date() }) {
  const r = normalizeRole(role);
  const plan = getUpgradePlan(r);

  if (!plan || !plan.nextSlug) {
    return {
      currentLabel: roleCommissionLabel(r),
      nextLabel: null,
      opsDone: operationsCount,
      opsRequired: null,
      opsRemaining: 0,
      monthsOnPlatform: userCreatedAt ? monthsBetween(userCreatedAt, now) : 0,
      minMonths: null,
      monthsRemaining: 0,
      canUpgradeByOps: false,
      canUpgradeByTime: false,
      canUpgrade: false,
      note: r === "ultra_premium" ? "Este rol es por invitación (manual)." : null,
    };
  }

  const monthsOnPlatform = userCreatedAt ? monthsBetween(userCreatedAt, now) : 0;

  const opsRequired = plan.nextOpsRequired ?? 0;
  const minMonths = plan.nextMinMonths ?? 0;

  const opsRemaining = Math.max(0, opsRequired - operationsCount);
  const monthsRemaining = Math.max(0, minMonths - monthsOnPlatform);

  const canUpgradeByOps = operationsCount >= opsRequired;
  const canUpgradeByTime = monthsOnPlatform >= minMonths;

  return {
    currentLabel: roleCommissionLabel(r),
    nextLabel: roleCommissionLabel(plan.nextSlug),
    nextSlug: plan.nextSlug,
    opsDone: operationsCount,
    opsRequired,
    opsRemaining,
    monthsOnPlatform,
    minMonths,
    monthsRemaining,
    canUpgradeByOps,
    canUpgradeByTime,
    canUpgrade: canUpgradeByOps && canUpgradeByTime,
    note: "Los upgrades se evalúan por tramos (operaciones) y tiempo mínimo.",
  };
}

// Statuses que consideramos como "operación válida" para sumar progreso (puedes ajustar si cambian en tu DB)
export const ORDER_COUNT_STATUSES = ["held", "buyer_ok", "ready_to_payout", "paid_out", "completed"];
