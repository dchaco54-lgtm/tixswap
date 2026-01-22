"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useProfile } from "@/hooks/useProfile";
import { useOnboardingLogic } from "@/hooks/useOnboardingLogic";
import WalletSection from "./WalletSection";
import MisPublicaciones from "./MisPublicaciones";
import StarRating from "@/components/StarRating";
import { normalizeRole, USER_TYPES } from "@/lib/roles";
import ProfileChangeModal from "@/components/ProfileChangeModal";
import AvatarUploadSection from "@/components/AvatarUploadSection";
import OnboardingWelcomeModal from "@/components/OnboardingWelcomeModal";
import { 
  getCurrentProfile, 
  updateProfile, 
  findOpenChangeTicket
} from "@/lib/profileActions";
import { formatRutForDisplay, formatEmailForDisplay } from "@/lib/formatUtils";
import { validateRut, formatRut, cleanRut } from "@/lib/rutUtils";
import { TIERS, TIER_DEFS, TIER_ORDER, tierLabel, normalizeTier } from "@/lib/tiers";

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

function getCategoryLabelByTier(tierRaw, tierLocked) {
  const normalized = normalizeTier(tierRaw);
  if (tierLocked && normalized === TIERS.FREE) return "Free (fijado)";
  if (tierLocked) return `${tierLabel(normalized)} (fijado)`;
  return tierLabel(normalized);
}

function getNextTierInfo({ soldCount, currentTier, tierLocked }) {
  const sold = Number(soldCount) || 0;
  const normalized = normalizeTier(currentTier);

  // Si está fijado (ej: Free), no hay progreso automático
  if (tierLocked) {
    return {
      nextKey: null,
      missing: "—",
      nextLabel: "Fijado por admin",
      required: null,
    };
  }

  // FREE se trata como Básico para progresión (pero solo si no está lockeado)
  const startTier = normalized === TIERS.FREE ? TIERS.BASIC : normalized;

  // Encuentra el siguiente tier con minSales mayor a las ventas actuales
  const nextKey = TIER_ORDER.find((key) => sold < (TIER_DEFS[key]?.minSales ?? Infinity));

  if (!nextKey) {
    return {
      nextKey: null,
      missing: 0,
      nextLabel: "Máximo nivel",
      required: TIER_DEFS[startTier]?.minSales ?? sold,
    };
  }

  const required = Number(TIER_DEFS[nextKey]?.minSales ?? 0);
  const missing = Math.max(0, required - sold);

  return {
    nextKey,
    missing,
    required,
    nextLabel: TIER_DEFS[nextKey]?.label || nextKey,
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
function DashboardContent() {
  const router = useRouter();
  const sp = useSearchParams();

  const [tab, setTab] = useState(sp.get("tab") || "mis_datos");

  const [user, setUser] = useState(null);
  
  // ✅ Hook con Realtime - fuente de verdad desde BD
  const { profile, loading: profileLoading, error: profileError, refetch: refetchProfile } = useProfile();

  // edición de perfil
  const [editing, setEditing] = useState(false);
  const [draftPhone, setDraftPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  // cambios de email/rut
  const [showChangeModal, setShowChangeModal] = useState(null); // null | 'email' | 'rut'
  const [openChangeTicket, setOpenChangeTicket] = useState(null);

  // Lógica de onboarding mejorada con rate limit
  const { shouldShow: shouldShowOnboarding, loading: onboardingLoading, handleDismiss: dismissOnboarding, handleComplete: completeOnboarding } = useOnboardingLogic(profile);

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

  // Prevenir scroll del body cuando el modal de venta está abierto
  useEffect(() => {
    if (openSale) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    
    return () => {
      document.body.style.overflow = '';
    };
  }, [openSale]);

  useEffect(() => {
    const init = async () => {
      const { data: { user: u } } = await supabase.auth.getUser();

      if (!u) {
        router.push("/login");
        return;
      }

      setUser(u);
    };

    init();
  }, [router]);

  // Sincronizar drafts cuando profile carga/cambia (Realtime)
  useEffect(() => {
    if (profile) {
      setDraftPhone((profile?.phone || "").trim());
    }
  }, [profile]);

  // Cargar ticket abierto para cambios
  useEffect(() => {
    const loadTickets = async () => {
      if (!user) return;

      const emailTicket = await findOpenChangeTicket("email");
      const rutTicket = await findOpenChangeTicket("rut");
      if (emailTicket.success && emailTicket.ticket) {
        setOpenChangeTicket(emailTicket.ticket);
      } else if (rutTicket.success && rutTicket.ticket) {
        setOpenChangeTicket(rutTicket.ticket);
      }
    };

    loadTickets();
  }, [user]);

  useEffect(() => {
    const urlTab = sp.get("tab");
    if (urlTab && urlTab !== tab) setTab(urlTab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sp]);

  const navItems = useMemo(() => {
    const isAdmin = normalizeRole(profile?.user_type) === USER_TYPES.ADMIN;

    return [
      { id: "mis_datos", label: "Mis datos" },
      { id: "mis_publicaciones", label: "Mis publicaciones", tourId: "sales" },
      { id: "wallet", label: "Wallet", tourId: "wallet" },
      { id: "vender", label: "🎫 Vender", href: "/sell", tourId: "sell" },

      // páginas ya existentes
      { id: "mis_compras", label: "Mis compras", href: "/dashboard/purchases", tourId: "purchases" },
      { id: "soporte", label: "Soporte", href: "/dashboard/soporte", tourId: "support" },
      { id: "tickets", label: "Mis tickets", href: "/dashboard/tickets" },

      ...(isAdmin ? [{ id: "admin", label: "Admin", href: "/admin" }] : []),
    ];
  }, [profile?.user_type]);

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
    setDraftPhone((profile?.phone || "").trim());
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setDraftPhone((profile?.phone || "").trim());
  };

  const saveProfile = async () => {
    setSaving(true);
    setMsg("");
    setErr("");

    try {
      const phone = String(draftPhone || "").trim();
      const result = await updateProfile({ phone });

      if (!result.success) {
        throw new Error(result.error);
      }

      // Refetch profile desde BD (Realtime lo actualizará automáticamente)
      await refetchProfile();

      setMsg("Teléfono actualizado ✅");
      setEditing(false);
    } catch (e) {
      setErr(e?.message || "No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarSuccess = async (avatarUrl) => {
    // Refetch para obtener la URL actualizada desde BD
    await refetchProfile();
    setMsg("Avatar actualizado ✅");
  };

  const handleChangeModalSuccess = async () => {
    // Recargar ticket abierto
    const ticketResult = await findOpenChangeTicket(showChangeModal);
    if (ticketResult.success && ticketResult.ticket) {
      setOpenChangeTicket(ticketResult.ticket);
    }
    setMsg(`Solicitud de cambio de ${showChangeModal === 'email' ? 'email' : 'RUT'} creada ✅`);
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

  // cuando entras a Mis publicaciones, carga todo
  useEffect(() => {
    if (!user?.id) return;
    if (tab !== "mis_publicaciones") return;

    loadSales();
    loadReputation(user.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, user?.id]);

  if (profileLoading || !user) {
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

  if (profileError) {
    return (
      <div className="min-h-screen bg-[#f4f7ff]">
        <div className="tix-container py-10">
          <div className="tix-card p-6 bg-red-50 border-red-200">
            <p className="text-red-600">Error cargando perfil: {profileError}</p>
            <button onClick={refetchProfile} className="mt-3 tix-btn-primary text-sm">
              Reintentar
            </button>
          </div>
        </div>
      </div>
    );
  }

  const soldCount = Number(salesData?.soldCount ?? 0) || 0;
  const paid90dCount = Number(salesData?.paid90dCount ?? 0) || 0;
  const paid90dTotal = Number(salesData?.paid90dTotal ?? 0) || 0;

  const currentSellerTier = profile?.seller_tier || profile?.tier;
  const sellerTierLocked =
    profile?.seller_tier_locked !== undefined
      ? profile?.seller_tier_locked
      : profile?.tier_locked;

  const tierProgress = getNextTierInfo({
    soldCount,
    currentTier: currentSellerTier,
    tierLocked: sellerTierLocked,
  });

  return (
    <>
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

      <div className="space-y-6">
            {/* =======================
                MIS DATOS
            ======================= */}
            {tab === "mis_datos" && (
              <div className="tix-card p-6">
                {/* Bloqueo */}
                {profile?.is_blocked && (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 mb-6">
                    <div className="text-sm font-bold text-rose-800">
                      🚫 Tu cuenta está bloqueada
                    </div>
                    <p className="text-xs text-rose-700 mt-1">
                      Contáctanos a soporte para más información.
                    </p>
                  </div>
                )}

                {/* Onboarding pendiente */}
                {shouldShowOnboarding && !onboardingLoading && (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 mb-6">
                    <div className="text-sm font-bold text-amber-800">
                      ⚠️ Perfil incompleto
                    </div>
                    <p className="text-xs text-amber-700 mt-1">
                      Completa tu perfil para comenzar a usar TixSwap.
                    </p>
                  </div>
                )}

                {/* Ticket abierto */}
                {openChangeTicket && (
                  <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 mb-6">
                    <div className="text-sm font-bold text-blue-800">
                      📋 Tienes una solicitud pendiente
                    </div>
                    <p className="text-xs text-blue-700 mt-1">
                      Ticket #{openChangeTicket.id} - Estado: <span className="font-semibold">{openChangeTicket.status}</span>
                    </p>
                  </div>
                )}

                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h1 className="text-2xl font-extrabold text-slate-900">Mi perfil</h1>
                    <p className="text-slate-600 mt-1">
                      Gestiona tu información de perfil y preferencias.
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
                    
                    {/* Avatar */}
                    <div className="px-5 py-4">
                      <AvatarUploadSection 
                        currentAvatarUrl={profile?.avatar_url}
                        userId={user?.id}
                        onSuccess={handleAvatarSuccess}
                      />
                    </div>

                    {/* Nombre */}
                    <div className="px-5 py-4 flex items-start justify-between gap-4">
                      <div className="w-full">
                        <div className="text-xs font-bold text-slate-500">
                          Nombre completo
                        </div>

                        <div className="flex items-start justify-between gap-3">
                          <div className="text-sm font-extrabold text-slate-900 mt-1">
                            {profile?.full_name || "Sin nombre (completa tu perfil)"}
                          </div>
                          <button
                            onClick={() => setShowChangeModal('name')}
                            className="tix-btn-ghost text-xs"
                            title="Crear solicitud de cambio"
                          >
                            Solicitar cambio
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Email */}
                    <div className="px-5 py-4 flex items-start justify-between gap-4">
                      <div className="w-full">
                        <div className="text-xs font-bold text-slate-500">Correo</div>

                        <div className="flex items-start justify-between gap-3">
                          <div className="text-sm font-extrabold text-slate-900 mt-1">
                            {profile?.email || user?.email || "—"}
                          </div>
                          <button
                            onClick={() => setShowChangeModal('email')}
                            className="tix-btn-ghost text-xs"
                            title="Crear solicitud de cambio"
                          >
                            Solicitar cambio
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* RUT */}
                    <div className="px-5 py-4 flex items-start justify-between gap-4">
                      <div className="w-full">
                        <div className="text-xs font-bold text-slate-500">
                          RUT
                        </div>

                        <div className="flex items-start justify-between gap-3">
                          <div className="text-sm font-extrabold text-slate-900 mt-1">
                            {profile?.rut ? formatRutForDisplay(profile.rut) : "—"}
                          </div>
                          <button
                            onClick={() => setShowChangeModal('rut')}
                            className="tix-btn-ghost text-xs"
                            title="Crear solicitud de cambio"
                          >
                            Solicitar cambio
                          </button>
                        </div>
                      </div>
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

                    {/* Estado removido del perfil visible */}

                    {/* Categoría (tier de segmentación) */}
                    <div className="px-5 py-4 flex items-start justify-between gap-4">
                      <div>
                        <div className="text-xs font-bold text-slate-500">Tier</div>

                        <div className="mt-2 inline-flex items-center gap-2 px-3 py-1 rounded-full border border-slate-200 bg-slate-50 text-slate-700 text-xs font-extrabold">
                                <span>{getCategoryLabelByTier(currentSellerTier, sellerTierLocked)}</span>
                                {sellerTierLocked ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                              Fijado admin
                            </span>
                          ) : null}
                        </div>

                        <div className="text-xs text-slate-400 mt-2">
                          (Segmentación visual, no afecta pagos)
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
                MIS PUBLICACIONES
            ======================= */}
            {tab === "mis_publicaciones" && <MisPublicaciones />}

            {/* Fallback */}
            {tab !== "mis_datos" && tab !== "wallet" && tab !== "mis_publicaciones" && (
              <div className="tix-card p-6">
                <h2 className="text-xl font-extrabold text-slate-900">Sección</h2>
                <p className="text-slate-600 mt-2">
                  Esta sección la dejamos lista pa’ después 😄
                </p>
              </div>
            )}
      </div>

      {/* =======================
          MODAL CHANGE EMAIL/RUT
      ======================= */}
      {showChangeModal && (
        <ProfileChangeModal
          field={showChangeModal}
          currentValue={
            showChangeModal === 'email'
              ? profile?.email || user?.email || ''
              : profile?.rut || ''
          }
          onClose={() => setShowChangeModal(null)}
          onSuccess={handleChangeModalSuccess}
        />
      )}

      {/* =======================
          MODAL ONBOARDING
      ======================= */}
      {shouldShowOnboarding && !onboardingLoading && (
        <OnboardingWelcomeModal
          profile={profile}
          onClose={() => {
            dismissOnboarding();
          }}
          onComplete={() => {
            completeOnboarding();
          }}
        />
      )}

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
    </>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Cargando...</div>}>
      <DashboardContent />
    </Suspense>
  );
}



