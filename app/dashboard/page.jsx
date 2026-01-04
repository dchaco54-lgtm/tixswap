"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../lib/supabaseClient";
import WalletSection from "./WalletSection";
import StarRating from "@/components/StarRating";
import { ROLE_DEFS, ROLE_ORDER, normalizeRole } from "@/lib/roles";

const PLAN_LABELS = {
  basic: "Básico",
  pro: "Pro",
  premium: "Premium",
  elite: "Elite",
  ultra_premium: "Ultra Premium",
};

function normalizePlan(role) {
  const r = String(role || "").trim().toLowerCase();
  if (!r) return "basic";
  if (r === "admin") return "admin";
  if (r === "seller") return "seller";
  if (PLAN_LABELS[r]) return r;
  if (r === "ultra" || r === "ultrapremium") return "ultra_premium";
  return "basic";
}

function getCategoryLabel(role) {
  const plan = normalizePlan(role);
  if (plan === "admin") return "Administrador";
  if (plan === "seller") return "Vendedor";
  return PLAN_LABELS[plan] || "Básico";
}

function getRoleDef(roleKey) {
  return ROLE_DEFS[roleKey] || ROLE_DEFS.basic;
}

function formatCLP(n) {
  const num = Number(n) || 0;
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(num);
}

function formatDateShort(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("es-CL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
}

function formatMonthLabel(isoOrKey) {
  // key tipo "YYYY-MM"
  const s = String(isoOrKey || "");
  const [y, m] = s.split("-");
  if (y && m) {
    const d = new Date(Number(y), Number(m) - 1, 1);
    return new Intl.DateTimeFormat("es-CL", { month: "short" }).format(d);
  }
  return "—";
}

function statusPill(status) {
  const s = String(status || "").toLowerCase();
  const base = "inline-flex items-center rounded-full px-2 py-1 text-[11px] font-bold";
  if (s === "paid") return <span className={`${base} bg-emerald-50 text-emerald-700`}>Pagada</span>;
  if (s === "dispute") return <span className={`${base} bg-amber-50 text-amber-700`}>Disputa</span>;
  if (s === "refunded") return <span className={`${base} bg-rose-50 text-rose-700`}>Reembolsada</span>;
  return <span className={`${base} bg-slate-100 text-slate-600`}>{s || "—"}</span>;
}

function buildPrefillTicket({ field, currentValue }) {
  const base = { category: "soporte", subject: "", message: "" };

  if (field === "name") {
    base.subject = "Solicitud de cambio de Nombre";
    base.message = `Hola soporte 👋

Quiero solicitar cambio de mi NOMBRE.

Nombre actual: ${currentValue || "—"}
Nombre nuevo: (escríbelo acá)

Motivo / respaldo: (opcional)
`;
    return base;
  }

  if (field === "rut") {
    base.subject = "Solicitud de cambio de RUT";
    base.message = `Hola soporte 👋

Quiero solicitar cambio de mi RUT.

RUT actual: ${currentValue || "—"}
RUT nuevo: (escríbelo acá)

Adjunto foto/validación si corresponde.
`;
    return base;
  }

  base.subject = "Solicitud a soporte";
  base.message = "Hola soporte 👋\n\n";
  return base;
}

function MiniBarChart({ data }) {
  const rows = Array.isArray(data) ? data : [];
  const max = Math.max(1, ...rows.map((r) => Number(r?.count) || 0));

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between">
        <div className="text-sm font-extrabold text-slate-900">Ventas últimos 6 meses</div>
        <div className="text-xs text-slate-500">*por compras pagadas</div>
      </div>

      <div className="mt-3 space-y-3">
        {rows.map((r) => {
          const count = Number(r?.count) || 0;
          const pct = Math.round((count / max) * 100);
          const label = r?.label || formatMonthLabel(r?.key);

          return (
            <div key={r?.key || label} className="flex items-center gap-3">
              <div className="w-12 text-xs font-bold text-slate-600">{label}</div>
              <div className="flex-1 h-3 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-3 rounded-full bg-blue-600"
                  style={{ width: `${pct}%` }}
                  aria-label={`${label}: ${count} ventas`}
                />
              </div>
              <div className="w-10 text-right text-xs font-extrabold text-slate-900">{count}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const sp = useSearchParams();

  const [tab, setTab] = useState(sp.get("tab") || "mis_datos");

  const [booting, setBooting] = useState(true);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);

  const [editing, setEditing] = useState(false);
  const [draftEmail, setDraftEmail] = useState("");
  const [draftPhone, setDraftPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  // Mis ventas
  const [salesLoading, setSalesLoading] = useState(false);
  const [salesErr, setSalesErr] = useState("");
  const [salesData, setSalesData] = useState(null);

  // Reputación
  const [repLoading, setRepLoading] = useState(false);
  const [repErr, setRepErr] = useState("");
  const [rep, setRep] = useState(null);

  // Modal detalle
  const [openSale, setOpenSale] = useState(null);

  useEffect(() => {
    const init = async () => {
      setBooting(true);
      setErr("");
      setMsg("");

      const { data: uRes } = await supabase.auth.getUser();
      const u = uRes?.user;

      if (!u) {
        router.push("/login");
        return;
      }

      setUser(u);

      const { data: p, error: pErr } = await supabase
        .from("profiles")
        .select("id, full_name, rut, email, phone, role")
        .eq("id", u.id)
        .maybeSingle();

      if (pErr) setErr(pErr.message);
      setProfile(p || null);

      setDraftEmail((p?.email || u.email || "").trim());
      setDraftPhone((p?.phone || "").trim());

      setBooting(false);
    };

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const urlTab = sp.get("tab");
    if (urlTab && urlTab !== tab) setTab(urlTab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sp]);

  const navItems = useMemo(() => {
    const isAdmin = String(profile?.role || "").toLowerCase() === "admin";
    return [
      { id: "resumen", label: "Resumen" },
      { id: "mis_datos", label: "Mis datos" },
      { id: "mis_ventas", label: "Mis ventas" },
      { id: "mis_compras", label: "Mis compras" },
      { id: "mis_calificaciones", label: "Mis calificaciones" },
      { id: "wallet", label: "Wallet" },
      { id: "soporte", label: "Soporte", href: "/dashboard/soporte" },
      { id: "tickets", label: "Mis tickets", href: "/dashboard/tickets" },
      ...(isAdmin ? [{ id: "admin", label: "Admin", href: "/admin/events" }] : []),
    ];
  }, [profile?.role]);

  const goTab = (id, href) => {
    setMsg("");
    setErr("");
    setEditing(false);

    if (href) {
      router.push(href);
      return;
    }

    setTab(id);
    router.replace(`/dashboard?tab=${encodeURIComponent(id)}`);
  };

  const requestChangeTicket = (field) => {
    const currentValue =
      field === "name" ? profile?.full_name : field === "rut" ? profile?.rut : "";

    const t = buildPrefillTicket({ field, currentValue });

    const qs = new URLSearchParams({
      new: "1",
      category: t.category,
      subject: t.subject,
      message: t.message,
    });

    router.push(`/dashboard/soporte?${qs.toString()}`);
  };

  const startEdit = () => {
    setMsg("");
    setErr("");
    setDraftEmail((profile?.email || user?.email || "").trim());
    setDraftPhone((profile?.phone || "").trim());
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setDraftEmail((profile?.email || user?.email || "").trim());
    setDraftPhone((profile?.phone || "").trim());
  };

  const saveProfile = async () => {
    setSaving(true);
    setMsg("");
    setErr("");

    try {
      const email = String(draftEmail || "").trim();
      const phone = String(draftPhone || "").trim();
      if (!email) throw new Error("El correo no puede estar vacío.");

      const { error: upErr } = await supabase.from("profiles").update({ email, phone }).eq("id", user.id);
      if (upErr) throw upErr;

      if ((user?.email || "").trim().toLowerCase() !== email.toLowerCase()) {
        const { error: aErr } = await supabase.auth.updateUser({ email });
        if (aErr) throw aErr;
        setMsg("Listo ✅ Te mandamos un correo para confirmar el cambio de email (si tu Supabase lo exige).");
      } else {
        setMsg("Datos actualizados ✅");
      }

      const { data: p } = await supabase
        .from("profiles")
        .select("id, full_name, rut, email, phone, role")
        .eq("id", user.id)
        .maybeSingle();

      setProfile(p || null);
      setEditing(false);
    } catch (e) {
      setErr(e?.message || "No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  };

  const loadSales = async () => {
    setSalesErr("");
    setSalesLoading(true);

    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess?.session?.access_token;
      if (!token) {
        setSalesErr("Sesión expirada. Vuelve a iniciar sesión.");
        setSalesData(null);
        return;
      }

      // months=24 para contar histórico razonable (y nivel por ventas)
      const r = await fetch("/api/orders/my-sales?months=24&listMonths=3", {
        headers: { Authorization: `Bearer ${token}` },
      });

      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setSalesErr(j?.error || "No se pudieron cargar tus ventas.");
        setSalesData(null);
        return;
      }

      setSalesData(j);

      // si backend subió categoría (computedRole), reflejamos altiro en UI
      if (j?.computedRole && profile?.role && String(profile.role).toLowerCase() !== String(j.computedRole).toLowerCase()) {
        setProfile((prev) => (prev ? { ...prev, role: j.computedRole } : prev));
      }

      if (j?.upgraded && j?.computedRole) {
        setMsg(`Subiste de categoría 🎉 Ahora eres ${getCategoryLabel(j.computedRole)}.`);
      }
    } catch (e) {
      setSalesErr("Error de red cargando tus ventas.");
      setSalesData(null);
    } finally {
      setSalesLoading(false);
    }
  };

  const loadReputation = async () => {
    if (!user?.id) return;

    setRepErr("");
    setRepLoading(true);

    try {
      const r = await fetch(`/api/sellers/reputation?sellerId=${encodeURIComponent(user.id)}`);
      const j = await r.json().catch(() => ({}));

      if (!r.ok) {
        setRepErr(j?.error || "No se pudo cargar reputación.");
        setRep(null);
        return;
      }

      setRep(j);
    } catch (e) {
      setRepErr("Error de red cargando reputación.");
      setRep(null);
    } finally {
      setRepLoading(false);
    }
  };

  // carga automática solo cuando entras a "Mis ventas"
  useEffect(() => {
    if (tab !== "mis_ventas") return;
    if (!user?.id) return;

    if (!salesData && !salesLoading) loadSales();
    if (!rep && !repLoading) loadReputation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, user?.id]);

  const levelInfo = useMemo(() => {
    const roleFromApi = salesData?.computedRole;
    const roleKey = normalizeRole(roleFromApi || profile?.role || "basic");
    const idx = ROLE_ORDER.indexOf(roleKey);

    const nextKey = idx >= 0 && idx < ROLE_ORDER.length - 1 ? ROLE_ORDER[idx + 1] : null;
    const nextDef = nextKey ? getRoleDef(nextKey) : null;

    // Para opción 3: usa paidAllTimeCount si existe; si no, cae al soldCount (MVP)
    const paidAllTime = Number(salesData?.paidAllTimeCount);
    const soldCount = Number(salesData?.soldCount);

    const opsCount = Number.isFinite(paidAllTime) ? paidAllTime : Number.isFinite(soldCount) ? soldCount : 0;
    const opsSource = Number.isFinite(paidAllTime) ? "paid" : "sold";

    const missing =
      nextDef ? Math.max(0, (Number(nextDef.opsRequired) || 0) - opsCount) : 0;

    const pct =
      nextDef && nextDef.opsRequired > 0
        ? Math.min(100, Math.round((opsCount / nextDef.opsRequired) * 100))
        : 100;

    return {
      roleKey,
      roleLabel: getCategoryLabel(roleKey),
      opsCount,
      opsSource,
      nextKey,
      nextLabel: nextKey ? getCategoryLabel(nextKey) : null,
      nextNeed: nextDef?.opsRequired ?? null,
      missing,
      pct,
    };
  }, [salesData, profile?.role]);

  if (booting) {
    return (
      <div className="min-h-screen bg-[#f4f7ff]">
        <div className="tix-container py-10">
          <div className="tix-card p-6">
            <p className="text-slate-600">Cargando dashboard…</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f4f7ff]">
      <div className="tix-container py-10">
        {(msg || err) && (
          <div className="mb-6">
            {msg && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-800 font-semibold">
                {msg}
              </div>
            )}
            {err && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-800 font-semibold mt-3">
                {err}
              </div>
            )}
          </div>
        )}

        <div className="grid lg:grid-cols-[260px_1fr] gap-6">
          {/* SIDEBAR */}
          <div className="tix-card p-4">
            <div className="text-sm font-extrabold text-slate-900 px-2">Panel</div>
            <div className="mt-3 space-y-1">
              {navItems.map((it) => {
                const active = it.href ? false : tab === it.id;
                return (
                  <button
                    key={it.id}
                    onClick={() => goTab(it.id, it.href)}
                    className={`w-full text-left px-3 py-2 rounded-xl text-sm font-semibold transition ${
                      active ? "bg-blue-600 text-white" : "text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    {it.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* CONTENT */}
          <div className="space-y-6">
            {/* MIS DATOS */}
            {tab === "mis_datos" && (
              <div className="tix-card p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h1 className="text-2xl font-extrabold text-slate-900">Mis datos</h1>
                    <p className="text-slate-600 mt-1">
                      Puedes editar solo <b>correo</b> y <b>teléfono</b>. Para cambiar <b>nombre</b> o <b>RUT</b>,
                      se solicita por ticket.
                    </p>
                  </div>

                  {!editing ? (
                    <button onClick={startEdit} className="tix-btn-primary">
                      Editar
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button onClick={saveProfile} disabled={saving} className="tix-btn-primary">
                        {saving ? "Guardando…" : "Guardar"}
                      </button>
                      <button onClick={cancelEdit} className="tix-btn-ghost">
                        Cancelar
                      </button>
                    </div>
                  )}
                </div>

                {/* LISTADO PRO */}
                <div className="mt-6 rounded-2xl border border-slate-100 bg-white">
                  <div className="divide-y divide-slate-100">
                    {/* Nombre */}
                    <div className="px-5 py-4 flex items-start justify-between gap-4">
                      <div>
                        <div className="text-xs font-bold text-slate-500">Nombre (bloqueado)</div>
                        <div className="text-sm font-extrabold text-slate-900 mt-1">
                          {profile?.full_name || "—"}
                        </div>
                      </div>
                      <button onClick={() => requestChangeTicket("name")} className="tix-btn-ghost">
                        Solicitar cambio
                      </button>
                    </div>

                    {/* Email */}
                    <div className="px-5 py-4 flex items-start justify-between gap-4">
                      <div className="w-full">
                        <div className="text-xs font-bold text-slate-500">Correo</div>

                        {!editing ? (
                          <div className="text-sm font-extrabold text-slate-900 mt-1">
                            {profile?.email || user?.email || "—"}
                          </div>
                        ) : (
                          <input
                            className="tix-input mt-2"
                            value={draftEmail}
                            onChange={(e) => setDraftEmail(e.target.value)}
                            placeholder="correo@ejemplo.com"
                          />
                        )}
                      </div>
                    </div>

                    {/* RUT */}
                    <div className="px-5 py-4 flex items-start justify-between gap-4">
                      <div>
                        <div className="text-xs font-bold text-slate-500">RUT (bloqueado)</div>
                        <div className="text-sm font-extrabold text-slate-900 mt-1">
                          {profile?.rut || "—"}
                        </div>
                      </div>
                      <button onClick={() => requestChangeTicket("rut")} className="tix-btn-ghost">
                        Solicitar cambio
                      </button>
                    </div>

                    {/* Teléfono */}
                    <div className="px-5 py-4 flex items-start justify-between gap-4">
                      <div className="w-full">
                        <div className="text-xs font-bold text-slate-500">Teléfono</div>

                        {!editing ? (
                          <div className="text-sm font-extrabold text-slate-900 mt-1">{profile?.phone || "—"}</div>
                        ) : (
                          <input
                            className="tix-input mt-2"
                            value={draftPhone}
                            onChange={(e) => setDraftPhone(e.target.value)}
                            placeholder="+569..."
                          />
                        )}
                      </div>
                    </div>

                    {/* Categoría */}
                    <div className="px-5 py-4 flex items-start justify-between gap-4">
                      <div>
                        <div className="text-xs font-bold text-slate-500">Categoría</div>

                        <div className="mt-2 inline-flex items-center px-3 py-1 rounded-full border border-slate-200 bg-slate-50 text-slate-700 text-xs font-extrabold">
                          {getCategoryLabel(profile?.role)}
                        </div>

                        <div className="text-xs text-slate-400 mt-2">
                          (Categoría/plan: basic / pro / premium…)
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* WALLET */}
            {tab === "wallet" && (
              <div className="tix-card p-6">
                <WalletSection />
              </div>
            )}

            {/* MIS VENTAS */}
            {tab === "mis_ventas" && (
              <div className="tix-card p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h1 className="text-2xl font-extrabold text-slate-900">Mis ventas</h1>
                    <p className="text-slate-600 mt-1">
                      Resumen, nivel, reputación y listado de ventas (últimos 3 meses).
                    </p>
                  </div>

                  <button onClick={loadSales} className="tix-btn-primary">
                    {salesLoading ? "Cargando…" : "Recargar"}
                  </button>
                </div>

                {(salesErr || repErr) && (
                  <div className="mt-5 space-y-2">
                    {salesErr && (
                      <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-800 font-semibold">
                        {salesErr}
                      </div>
                    )}
                    {repErr && (
                      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800 font-semibold">
                        {repErr}
                      </div>
                    )}
                  </div>
                )}

                {!salesData && salesLoading ? (
                  <div className="mt-6 text-slate-600">Cargando…</div>
                ) : !salesData ? (
                  <div className="mt-6 text-slate-600">Aún no hay datos de ventas.</div>
                ) : (
                  <>
                    {/* TOP CARDS */}
                    <div className="mt-6 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className="rounded-2xl border border-slate-100 bg-white p-5">
                        <div className="text-xs font-bold text-slate-500">Tickets vendidos</div>
                        <div className="mt-2 text-2xl font-extrabold text-slate-900">
                          {Number(salesData?.soldCount) || 0}
                        </div>
                        <div className="mt-1 text-xs text-slate-400">status: sold</div>
                      </div>

                      <div className="rounded-2xl border border-slate-100 bg-white p-5">
                        <div className="text-xs font-bold text-slate-500">Ventas pagadas</div>
                        <div className="mt-2 text-2xl font-extrabold text-slate-900">
                          {Number.isFinite(Number(salesData?.paidAllTimeCount))
                            ? Number(salesData?.paidAllTimeCount)
                            : "—"}
                        </div>
                        <div className="mt-1 text-xs text-slate-400">
                          {Number.isFinite(Number(salesData?.paidAllTimeCount)) ? "paid (histórico)" : "activa paidAllTimeCount en API"}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-slate-100 bg-white p-5">
                        <div className="text-xs font-bold text-slate-500">Total (90 días)</div>
                        <div className="mt-2 text-2xl font-extrabold text-slate-900">
                          {formatCLP(salesData?.paid90dTotal)}
                        </div>
                        <div className="mt-1 text-xs text-slate-400">compras pagadas</div>
                      </div>

                      <div className="rounded-2xl border border-slate-100 bg-white p-5">
                        <div className="text-xs font-bold text-slate-500">Calificación</div>
                        <div className="mt-2 flex items-center justify-between gap-3">
                          {repLoading ? (
                            <div className="text-slate-600">Cargando…</div>
                          ) : rep?.score ? (
                            <StarRating value={rep.score} text={`${rep.score}/5`} />
                          ) : (
                            <div className="text-sm font-extrabold text-slate-900">
                              Usuario nuevo
                              <div className="text-xs text-slate-400 mt-1">(< 5 ventas)</div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* NIVEL + PROGRESO */}
                    <div className="mt-6 rounded-2xl border border-slate-100 bg-white p-5">
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div>
                          <div className="text-xs font-bold text-slate-500">Tu categoría actual</div>
                          <div className="mt-2 inline-flex items-center px-3 py-1 rounded-full border border-slate-200 bg-slate-50 text-slate-800 text-xs font-extrabold">
                            {levelInfo.roleLabel}
                          </div>

                          <div className="mt-2 text-xs text-slate-500">
                            Conteo para nivel: <b>{levelInfo.opsCount}</b>{" "}
                            <span className="text-slate-400">
                              ({levelInfo.opsSource === "paid" ? "ventas pagadas" : "tickets sold"})
                            </span>
                          </div>
                        </div>

                        <div className="min-w-[260px]">
                          {levelInfo.nextKey ? (
                            <>
                              <div className="text-xs font-bold text-slate-500">
                                Te faltan <span className="text-slate-900">{levelInfo.missing}</span> ventas para subir a{" "}
                                <span className="text-slate-900">{levelInfo.nextLabel}</span>
                              </div>

                              <div className="mt-2 h-3 rounded-full bg-slate-100 overflow-hidden">
                                <div
                                  className="h-3 rounded-full bg-blue-600"
                                  style={{ width: `${levelInfo.pct}%` }}
                                />
                              </div>

                              <div className="mt-2 text-xs text-slate-500">
                                Meta: {levelInfo.nextNeed} ventas
                              </div>
                            </>
                          ) : (
                            <div className="text-xs font-bold text-emerald-700">
                              Estás en el nivel máximo 🔥
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* GRÁFICO */}
                    <div className="mt-6 rounded-2xl border border-slate-100 bg-white p-5">
                      <MiniBarChart data={salesData?.monthly || []} />
                    </div>

                    {/* LISTADO */}
                    <div className="mt-6 rounded-2xl border border-slate-100 bg-white">
                      <div className="px-5 py-4 flex items-center justify-between">
                        <div>
                          <div className="text-sm font-extrabold text-slate-900">Ventas (últimos 3 meses)</div>
                          <div className="text-xs text-slate-500">Máximo 200 registros (MVP)</div>
                        </div>
                        <div className="text-xs text-slate-500">
                          Total pagadas 90d: <b>{Number(salesData?.paid90dCount) || 0}</b>
                        </div>
                      </div>

                      <div className="border-t border-slate-100">
                        {Array.isArray(salesData?.recentSales) && salesData.recentSales.length > 0 ? (
                          <div className="divide-y divide-slate-100">
                            {salesData.recentSales.map((s) => {
                              const ev = s?.ticket?.event;
                              const when = s?.paid_at || s?.created_at;
                              const buyerName = s?.buyer?.full_name || "Comprador";
                              const total = s?.total_paid_clp ?? s?.total_clp ?? 0;
                              const st = String(s?.status || s?.payment_state || "paid").toLowerCase();

                              return (
                                <div key={s.id} className="px-5 py-4 flex items-start justify-between gap-4">
                                  <div className="min-w-0">
                                    <div className="text-sm font-extrabold text-slate-900 truncate">
                                      {ev?.title || "Venta"}
                                    </div>

                                    <div className="mt-1 text-xs text-slate-500">
                                      {formatDateShort(when)} · {ev?.venue || "—"}{ev?.city ? `, ${ev.city}` : ""}
                                    </div>

                                    <div className="mt-2 flex items-center gap-2">
                                      <span className="text-xs font-bold text-slate-600">Comprador:</span>
                                      <span className="text-xs font-extrabold text-slate-900 truncate">{buyerName}</span>
                                      <span className="text-xs text-slate-400">·</span>
                                      <span className="text-xs font-extrabold text-slate-900">{formatCLP(total)}</span>
                                    </div>
                                  </div>

                                  <div className="shrink-0 flex items-center gap-3">
                                    {statusPill(st)}
                                    <button
                                      className="tix-btn-primary"
                                      onClick={() => setOpenSale(s)}
                                    >
                                      Ver detalle
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="px-5 py-6 text-slate-600">
                            No hay ventas en los últimos 3 meses.
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* PLACEHOLDER */}
            {tab !== "mis_datos" && tab !== "wallet" && tab !== "mis_ventas" && (
              <div className="tix-card p-6">
                <h2 className="text-xl font-extrabold text-slate-900">
                  {navItems.find((x) => x.id === tab)?.label || "Sección"}
                </h2>
                <p className="text-slate-600 mt-2">Esta sección la dejamos lista pa’ después 😄</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MODAL DETALLE */}
      {openSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setOpenSale(null)} />
          <div className="relative w-full max-w-2xl rounded-3xl bg-white shadow-xl border border-slate-100 overflow-hidden">
            <div className="px-6 py-5 flex items-start justify-between gap-4 border-b border-slate-100">
              <div className="min-w-0">
                <div className="text-xs font-bold text-slate-500">Detalle venta</div>
                <div className="mt-1 text-lg font-extrabold text-slate-900 truncate">
                  {openSale?.ticket?.event?.title || "Venta"}
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  Orden: <b className="text-slate-700">{openSale?.id}</b>
                </div>
              </div>

              <button className="tix-btn-ghost" onClick={() => setOpenSale(null)}>
                Cerrar
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="rounded-2xl border border-slate-100 p-4">
                  <div className="text-xs font-bold text-slate-500">Fecha</div>
                  <div className="mt-1 text-sm font-extrabold text-slate-900">
                    {formatDateShort(openSale?.paid_at || openSale?.created_at)}
                  </div>
                  <div className="mt-2 text-xs text-slate-500">
                    {openSale?.ticket?.event?.venue || "—"}
                    {openSale?.ticket?.event?.city ? `, ${openSale.ticket.event.city}` : ""}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-100 p-4">
                  <div className="text-xs font-bold text-slate-500">Total</div>
                  <div className="mt-1 text-sm font-extrabold text-slate-900">
                    {formatCLP(openSale?.total_paid_clp ?? openSale?.total_clp ?? 0)}
                  </div>
                  <div className="mt-2">{statusPill(String(openSale?.status || openSale?.payment_state || "paid"))}</div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-100 p-4">
                <div className="text-xs font-bold text-slate-500">Comprador</div>
                <div className="mt-1 text-sm font-extrabold text-slate-900">
                  {openSale?.buyer?.full_name || "Comprador"}
                </div>
                {openSale?.buyer?.email ? (
                  <div className="mt-1 text-xs text-slate-500">{openSale.buyer.email}</div>
                ) : null}
              </div>

              <div className="rounded-2xl border border-slate-100 p-4">
                <div className="text-xs font-bold text-slate-500">Ticket</div>
                <div className="mt-2 text-sm text-slate-700">
                  <div>
                    <b>Sector:</b> {openSale?.ticket?.sector || "—"}{" "}
                    <b className="ml-3">Fila:</b> {openSale?.ticket?.row || "—"}{" "}
                    <b className="ml-3">Asiento:</b> {openSale?.ticket?.seat || "—"}
                  </div>
                  {openSale?.ticket?.notes ? (
                    <div className="mt-2 text-xs text-slate-500">{openSale.ticket.notes}</div>
                  ) : null}
                </div>
              </div>

              <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
                <div className="text-sm font-extrabold text-slate-900">Chat con comprador (pronto)</div>
                <div className="mt-1 text-sm text-slate-700">
                  Acá va el chat compra/venta y el flujo de post-venta. Lo dejo preparado para enchufarlo sin romper tu UX.
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-2">
              <button className="tix-btn-ghost" onClick={() => setOpenSale(null)}>
                Cerrar
              </button>
              <button className="tix-btn-primary" onClick={() => router.push("/dashboard/soporte?new=1")}>
                Ir a soporte
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


