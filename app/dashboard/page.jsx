"use client";

export const dynamic = 'force-dynamic';

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import WalletSection from "./WalletSection";
import StarRating from "@/components/StarRating";
import { ROLE_DEFS, ROLE_ORDER, normalizeRole } from "@/lib/roles";

/* =========================
   Helpers
========================= */
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
  return d.toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("es-CL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusPill(status, paymentState) {
  const s = String(status || "").toLowerCase();
  const ps = String(paymentState || "").toLowerCase();

  const base =
    "inline-flex items-center rounded-full px-2 py-1 text-[11px] font-extrabold";

  if (s === "paid" || ps === "paid") {
    return (
      <span className={`${base} bg-emerald-50 text-emerald-700`}>
        Pagada
      </span>
    );
  }
  if (s === "dispute") {
    return (
      <span className={`${base} bg-amber-50 text-amber-800`}>
        Disputa
      </span>
    );
  }
  if (s === "refunded") {
    return (
      <span className={`${base} bg-rose-50 text-rose-700`}>
        Reembolsada
      </span>
    );
  }

  return (
    <span className={`${base} bg-slate-100 text-slate-600`}>
      {s || ps || "—"}
    </span>
  );
}

function safeText(v, fallback = "—") {
  const t = String(v ?? "").trim();
  return t ? t : fallback;
}

function getCategoryLabel(roleRaw) {
  const r = String(roleRaw || "").trim().toLowerCase();
  if (r === "admin") return "Administrador";
  if (r === "seller") return "Vendedor";
  const key = normalizeRole(r);
  return ROLE_DEFS[key]?.name || "Básico";
}

function getNextTierInfo(soldCount) {
  const sold = Number(soldCount) || 0;

  // Encuentra el siguiente nivel cuyo opsRequired sea mayor a sold
  const nextKey = ROLE_ORDER.find((k) => sold < (ROLE_DEFS[k]?.opsRequired ?? 0));

  if (!nextKey) {
    return {
      nextKey: null,
      missing: 0,
      nextLabel: "Máximo nivel",
      required: sold,
    };
  }

  const required = Number(ROLE_DEFS[nextKey]?.opsRequired ?? 0);
  const missing = Math.max(0, required - sold);

  return {
    nextKey,
    missing,
    required,
    nextLabel: ROLE_DEFS[nextKey]?.name || nextKey,
  };
}

function buildPrefillTicket({ field, currentValue, extraContext = "" }) {
  const base = {
    category: "soporte",
    subject: "",
    message: "",
  };

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

  if (field === "venta") {
    base.category = "disputa_venta";
    base.subject = "Ayuda con una venta";
    base.message = `Hola soporte 👋

Necesito ayuda con una venta.

${extraContext}

Detalle del problema:
- (Escribe acá lo que pasó)
`;
    return base;
  }

  base.subject = "Solicitud a soporte";
  base.message = "Hola soporte 👋\n\n";
  return base;
}

/* =========================
   Tiny chart (simple)
========================= */
function MiniBarChart({ items }) {
  const max = Math.max(1, ...items.map((x) => Number(x.count) || 0));

  return (
    <div className="mt-3 grid grid-cols-6 gap-3">
      {items.map((m) => {
        const c = Number(m.count) || 0;
        const pct = Math.round((c / max) * 100);

        return (
          <div key={m.key} className="rounded-2xl border border-slate-200 bg-white p-3">
            <div className="text-xs font-bold text-slate-500">{m.label}</div>

            <div className="mt-2 h-2 w-full rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-2 rounded-full bg-blue-600"
                style={{ width: `${pct}%` }}
              />
            </div>

            <div className="mt-2 flex items-center justify-between">
              <div className="text-sm font-extrabold text-slate-900">{c}</div>
              <div className="text-[11px] font-semibold text-slate-500">ventas</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* =========================
   Page
========================= */
export default function DashboardPage() {
  const router = useRouter();
  const sp = useSearchParams();

  const [tab, setTab] = useState(sp.get("tab") || "mis_datos");

  const [booting, setBooting] = useState(true);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);

  // edición
  const [editing, setEditing] = useState(false);
  const [draftEmail, setDraftEmail] = useState("");
  const [draftPhone, setDraftPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  // ventas
  const [salesLoading, setSalesLoading] = useState(false);
  const [salesErr, setSalesErr] = useState("");
  const [salesData, setSalesData] = useState(null);

  // reputación
  const [repLoading, setRepLoading] = useState(false);
  const [repErr, setRepErr] = useState("");
  const [rep, setRep] = useState(null);

  // modal detalle venta
  const [openSale, setOpenSale] = useState(null);

  useEffect(() => {
    const init = async () => {
      setBooting(true);
      setErr("");
      setMsg("");

      const {
        data: { user: u },
      } = await supabase.auth.getUser();

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
      { id: "mis_datos", label: "Mis datos" },
      { id: "mis_ventas", label: "Mis ventas" },
      { id: "wallet", label: "Wallet" },

      // páginas ya existentes
      { id: "mis_compras", label: "Mis compras", href: "/dashboard/purchases" },
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

  const requestSaleHelp = (sale) => {
    const extra = `Orden: ${sale?.id || "—"}
Evento: ${sale?.ticket?.event?.title || "—"}
Comprador: ${sale?.buyer?.full_name || sale?.buyer?.email || "—"}
Monto: ${formatCLP(sale?.total_paid_clp ?? sale?.total_clp)}
Fecha: ${formatDateTime(sale?.paid_at || sale?.created_at)}
`;

    const t = buildPrefillTicket({
      field: "venta",
      extraContext: extra,
    });

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

      // 1) actualizar tabla profiles (solo email + phone)
      const { error: upErr } = await supabase
        .from("profiles")
        .update({ email, phone })
        .eq("id", user.id);

      if (upErr) throw upErr;

      // 2) si cambió email, actualizar auth (puede pedir confirmación)
      if ((user?.email || "").trim().toLowerCase() !== email.toLowerCase()) {
        const { error: aErr } = await supabase.auth.updateUser({ email });
        if (aErr) throw aErr;

        setMsg(
          "Listo ✅ Te mandamos un correo para confirmar el cambio de email (si tu Supabase lo exige)."
        );
      } else {
        setMsg("Datos actualizados ✅");
      }

      // refresh profile
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
    setSalesLoading(true);
    setSalesErr("");
    try {
      const { data: sessionRes } = await supabase.auth.getSession();
      const token = sessionRes?.session?.access_token;

      if (!token) {
        router.replace(`/login?redirectTo=${encodeURIComponent("/dashboard?tab=mis_ventas")}`);
        return;
      }

      const r = await fetch("/api/orders/my-sales?months=6&listMonths=3", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });

      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "No pude cargar tus ventas.");

      setSalesData(j || null);
    } catch (e) {
      setSalesErr(e?.message || "No pude cargar ventas.");
    } finally {
      setSalesLoading(false);
    }
  };

  const loadReputation = async (sellerId) => {
    setRepLoading(true);
    setRepErr("");
    try {
      const r = await fetch(`/api/sellers/reputation?sellerId=${encodeURIComponent(sellerId)}`, {
        cache: "no-store",
      });

      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "No pude cargar reputación.");

      setRep(j || null);
    } catch (e) {
      setRepErr(e?.message || "No pude cargar reputación.");
    } finally {
      setRepLoading(false);
    }
  };

  // cuando entras a Mis ventas, carga todo
  useEffect(() => {
    if (!user?.id) return;
    if (tab !== "mis_ventas") return;

    loadSales();
    loadReputation(user.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, user?.id]);

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

  const soldCount = Number(salesData?.soldCount ?? 0) || 0;
  const paid90dCount = Number(salesData?.paid90dCount ?? 0) || 0;
  const paid90dTotal = Number(salesData?.paid90dTotal ?? 0) || 0;

  const tier = getNextTierInfo(soldCount);

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
                      active
                        ? "bg-blue-600 text-white"
                        : "text-slate-700 hover:bg-slate-100"
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
            {/* =======================
                MIS DATOS
            ======================= */}
            {tab === "mis_datos" && (
              <div className="tix-card p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h1 className="text-2xl font-extrabold text-slate-900">Mis datos</h1>
                    <p className="text-slate-600 mt-1">
                      Puedes editar solo <b>correo</b> y <b>teléfono</b>. Para cambiar{" "}
                      <b>nombre</b> o <b>RUT</b>, se solicita por ticket.
                    </p>
                  </div>

                  {!editing ? (
                    <button onClick={startEdit} className="tix-btn-primary">
                      Editar
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={saveProfile}
                        disabled={saving}
                        className="tix-btn-primary"
                      >
                        {saving ? "Guardando…" : "Guardar"}
                      </button>
                      <button onClick={cancelEdit} className="tix-btn-ghost">
                        Cancelar
                      </button>
                    </div>
                  )}
                </div>

                {/* LISTADO */}
                <div className="mt-6 rounded-2xl border border-slate-100 bg-white">
                  <div className="divide-y divide-slate-100">
                    {/* Nombre */}
                    <div className="px-5 py-4 flex items-start justify-between gap-4">
                      <div>
                        <div className="text-xs font-bold text-slate-500">
                          Nombre (bloqueado)
                        </div>
                        <div className="text-sm font-extrabold text-slate-900 mt-1">
                          {profile?.full_name || "—"}
                        </div>
                      </div>
                      <button
                        onClick={() => requestChangeTicket("name")}
                        className="tix-btn-ghost"
                        title="Crear ticket prellenado"
                      >
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
                        <div className="text-xs font-bold text-slate-500">
                          RUT (bloqueado)
                        </div>
                        <div className="text-sm font-extrabold text-slate-900 mt-1">
                          {profile?.rut || "—"}
                        </div>
                      </div>
                      <button
                        onClick={() => requestChangeTicket("rut")}
                        className="tix-btn-ghost"
                        title="Crear ticket prellenado"
                      >
                        Solicitar cambio
                      </button>
                    </div>

                    {/* Teléfono */}
                    <div className="px-5 py-4 flex items-start justify-between gap-4">
                      <div className="w-full">
                        <div className="text-xs font-bold text-slate-500">
                          Teléfono
                        </div>

                        {!editing ? (
                          <div className="text-sm font-extrabold text-slate-900 mt-1">
                            {profile?.phone || "—"}
                          </div>
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
                          (La categoría viene del plan: basic / pro / premium…)
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* =======================
                WALLET
            ======================= */}
            {tab === "wallet" && (
              <div className="tix-card p-6">
                <WalletSection />
              </div>
            )}

            {/* =======================
                MIS VENTAS
            ======================= */}
            {tab === "mis_ventas" && (
              <div className="tix-card p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h1 className="text-2xl font-extrabold text-slate-900">
                      Mis ventas
                    </h1>
                    <p className="text-slate-600 mt-1">
                      Resumen + historial (últimos 3 meses) + gráfico (6 meses).
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        loadSales();
                        if (user?.id) loadReputation(user.id);
                      }}
                      className="tix-btn-ghost"
                    >
                      Recargar
                    </button>
                  </div>
                </div>

                {(salesErr || repErr) && (
                  <div className="mt-4">
                    {salesErr ? (
                      <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-800 font-semibold">
                        {salesErr}
                      </div>
                    ) : null}
                    {repErr ? (
                      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900 font-semibold mt-3">
                        {repErr}
                      </div>
                    ) : null}
                  </div>
                )}

                {/* Cards */}
                <div className="mt-6 grid md:grid-cols-4 gap-4">
                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="text-xs font-bold text-slate-500">
                      Tickets vendidos (sold)
                    </div>
                    <div className="mt-2 text-3xl font-extrabold text-slate-900">
                      {salesLoading ? "—" : soldCount}
                    </div>
                    <div className="mt-2 text-xs text-slate-400">
                      (Base para subir de nivel)
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="text-xs font-bold text-slate-500">
                      Pagadas (últ. 90 días)
                    </div>
                    <div className="mt-2 text-3xl font-extrabold text-slate-900">
                      {salesLoading ? "—" : paid90dCount}
                    </div>
                    <div className="mt-2 text-xs text-slate-400">
                      Total: {salesLoading ? "—" : formatCLP(paid90dTotal)}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="text-xs font-bold text-slate-500">Faltan para subir</div>
                    <div className="mt-2 text-3xl font-extrabold text-slate-900">
                      {salesLoading ? "—" : tier.missing}
                    </div>
                    <div className="mt-2 text-xs text-slate-400">
                      Próximo: {salesLoading ? "—" : tier.nextLabel}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="text-xs font-bold text-slate-500">Calificación</div>

                    <div className="mt-2">
                      {repLoading ? (
                        <div className="text-slate-600 font-semibold">Cargando…</div>
                      ) : rep?.score ? (
                        <StarRating
                          value={rep.score}
                          text={`${rep.score} (${rep.sales_count ?? soldCount} ventas)`}
                        />
                      ) : (
                        <div className="text-sm font-extrabold text-slate-900">
                          Usuario nuevo
                          <div className="text-xs text-slate-400 mt-1">
                            (Menos de 5 ventas)
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="mt-2 text-xs text-slate-400">
                      Comentarios: <span className="font-semibold">pronto</span>
                    </div>
                  </div>
                </div>

                {/* Chart */}
                <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-lg font-extrabold text-slate-900">
                        Ventas últimos 6 meses
                      </div>
                      <div className="text-sm text-slate-600">
                        Cantidad de operaciones pagadas por mes.
                      </div>
                    </div>

                    <div className="text-xs text-slate-500">
                      (simple, pero pro 😄)
                    </div>
                  </div>

                  {salesLoading ? (
                    <div className="mt-4 text-slate-600">Cargando gráfico…</div>
                  ) : (
                    <MiniBarChart items={salesData?.monthly || []} />
                  )}
                </div>

                {/* List */}
                <div className="mt-6 rounded-2xl border border-slate-200 bg-white overflow-hidden">
                  <div className="p-5">
                    <div className="text-lg font-extrabold text-slate-900">
                      Ventas recientes (máx 3 meses)
                    </div>
                    <div className="text-sm text-slate-600 mt-1">
                      Puedes abrir el detalle y pedir ayuda a soporte si algo sale raro.
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="min-w-full text-left">
                      <thead className="bg-slate-50 border-y border-slate-200">
                        <tr className="text-xs font-extrabold text-slate-600">
                          <th className="px-5 py-3">Fecha</th>
                          <th className="px-5 py-3">Evento</th>
                          <th className="px-5 py-3">Comprador</th>
                          <th className="px-5 py-3">Monto</th>
                          <th className="px-5 py-3">Estado</th>
                          <th className="px-5 py-3 text-right">Acción</th>
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-slate-100">
                        {salesLoading ? (
                          <tr>
                            <td className="px-5 py-4 text-slate-600" colSpan={6}>
                              Cargando ventas…
                            </td>
                          </tr>
                        ) : (salesData?.recentSales || []).length === 0 ? (
                          <tr>
                            <td className="px-5 py-6 text-slate-600" colSpan={6}>
                              Aún no tienes ventas pagadas en este período.
                            </td>
                          </tr>
                        ) : (
                          (salesData?.recentSales || []).slice(0, 200).map((s) => {
                            const when = s.paid_at || s.created_at;
                            const buyer = s?.buyer?.full_name || s?.buyer?.email || "—";
                            const eventTitle = s?.ticket?.event?.title || "—";
                            const total = Number(s.total_paid_clp ?? s.total_clp ?? 0) || 0;

                            return (
                              <tr key={s.id} className="hover:bg-slate-50">
                                <td className="px-5 py-4 text-sm font-semibold text-slate-700">
                                  {formatDateShort(when)}
                                </td>

                                <td className="px-5 py-4">
                                  <div className="text-sm font-extrabold text-slate-900">
                                    {eventTitle}
                                  </div>
                                  <div className="text-xs text-slate-500 mt-1">
                                    {safeText(s?.ticket?.event?.venue, "")}
                                    {s?.ticket?.event?.city ? ` · ${s.ticket.event.city}` : ""}
                                  </div>
                                </td>

                                <td className="px-5 py-4">
                                  <div className="text-sm font-semibold text-slate-800">
                                    {buyer}
                                  </div>
                                </td>

                                <td className="px-5 py-4">
                                  <div className="text-sm font-extrabold text-slate-900">
                                    {formatCLP(total)}
                                  </div>
                                </td>

                                <td className="px-5 py-4">
                                  {statusPill(s.status, s.payment_state)}
                                </td>

                                <td className="px-5 py-4 text-right">
                                  <button
                                    className="tix-btn-primary"
                                    onClick={() => setOpenSale(s)}
                                  >
                                    Ver detalle
                                  </button>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Fallback */}
            {tab !== "mis_datos" && tab !== "wallet" && tab !== "mis_ventas" && (
              <div className="tix-card p-6">
                <h2 className="text-xl font-extrabold text-slate-900">Sección</h2>
                <p className="text-slate-600 mt-2">
                  Esta sección la dejamos lista pa’ después 😄
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* =======================
          MODAL DETALLE VENTA
      ======================= */}
      {openSale ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpenSale(null)}
          />
          <div className="relative w-full max-w-2xl tix-card p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xl font-extrabold text-slate-900">Detalle de venta</div>
                <div className="text-sm text-slate-600 mt-1">
                  Orden: <span className="font-semibold">{openSale.id}</span>
                </div>
              </div>

              <button className="tix-btn-ghost" onClick={() => setOpenSale(null)}>
                Cerrar
              </button>
            </div>

            <div className="mt-5 grid md:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="text-xs font-bold text-slate-500">Evento</div>
                <div className="mt-2 text-sm font-extrabold text-slate-900">
                  {openSale?.ticket?.event?.title || "—"}
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  {safeText(openSale?.ticket?.event?.venue, "")}
                  {openSale?.ticket?.event?.city ? ` · ${openSale.ticket.event.city}` : ""}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="text-xs font-bold text-slate-500">Comprador</div>
                <div className="mt-2 text-sm font-extrabold text-slate-900">
                  {openSale?.buyer?.full_name || openSale?.buyer?.email || "—"}
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  {openSale?.buyer?.email || ""}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="text-xs font-bold text-slate-500">Monto</div>
                <div className="mt-2 text-2xl font-extrabold text-slate-900">
                  {formatCLP(openSale?.total_paid_clp ?? openSale?.total_clp)}
                </div>
                <div className="mt-2">{statusPill(openSale?.status, openSale?.payment_state)}</div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="text-xs font-bold text-slate-500">Fecha</div>
                <div className="mt-2 text-sm font-extrabold text-slate-900">
                  {formatDateTime(openSale?.paid_at || openSale?.created_at)}
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  Ticket: {openSale?.ticket?.id || "—"}
                </div>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-between gap-3">
              <button className="tix-btn-ghost" onClick={() => setOpenSale(null)}>
                Listo
              </button>

              <div className="flex items-center gap-2">
                <button
                  className="tix-btn-secondary"
                  onClick={() => requestSaleHelp(openSale)}
                >
                  Pedir ayuda a soporte
                </button>
                <button
                  className="tix-btn-primary"
                  onClick={() => {
                    // por ahora: te llevo a Soporte con ticket prellenado,
                    // el chat comprador↔vendedor lo armamos después cuando exista.
                    requestSaleHelp(openSale);
                  }}
                >
                  Abrir ticket
                </button>
              </div>
            </div>

            <div className="mt-4 text-xs text-slate-500">
              Nota: El chat comprador↔vendedor lo enchufamos cuando tengamos esa feature lista.
              Por ahora, soporte resuelve y deja evidencia.
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}



