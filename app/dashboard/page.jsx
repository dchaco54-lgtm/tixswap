// app/dashboard/page.jsx
"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../lib/supabaseClient";
import WalletSection from "./WalletSection";
import {
  ROLE_OPTIONS,
  normalizeRole,
  roleCommissionLabel,
  getUpgradeProgress,
  ORDER_COUNT_STATUSES,
} from "@/lib/roles";

export default function DashboardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const sectionParam = searchParams?.get("section") || "Resumen";

  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);

  const [activeSection, setActiveSection] = useState(sectionParam);
  const [loading, setLoading] = useState(true);

  const [ordersCount, setOrdersCount] = useState(null);
  const [ordersCountError, setOrdersCountError] = useState(null);

  useEffect(() => {
    setActiveSection(sectionParam);
  }, [sectionParam]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);

      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();

      if (!authUser) {
        router.push("/login");
        return;
      }

      setUser(authUser);

      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("id, email, full_name, rut, phone, role, created_at")
        .eq("id", authUser.id)
        .single();

      if (profileError) {
        console.error(profileError);
      }

      setProfile(profileData || null);
      setLoading(false);
    };

    load();
  }, [router]);

  // Contar operaciones válidas para progreso de roles
  useEffect(() => {
    const countOps = async () => {
      if (!user?.id) return;

      setOrdersCountError(null);

      try {
        // Intento #1: contar operaciones donde el usuario participó (buyer o seller)
        // Ajusta "buyer_id" y "seller_id" si tu tabla usa otros nombres.
        const { count, error } = await supabase
          .from("orders")
          .select("id", { count: "exact", head: true })
          .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
          .in("status", ORDER_COUNT_STATUSES);

        if (error) {
          console.warn("No se pudo contar orders (RLS o tabla).", error);
          setOrdersCount(null);
          setOrdersCountError(
            "Pronto verás aquí tu progreso (estamos conectando el historial de operaciones)."
          );
          return;
        }

        setOrdersCount(count ?? 0);
      } catch (e) {
        console.warn(e);
        setOrdersCount(null);
        setOrdersCountError(
          "Pronto verás aquí tu progreso (estamos conectando el historial de operaciones)."
        );
      }
    };

    countOps();
  }, [user?.id]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  const roleSlug = normalizeRole(profile?.role);
  const roleLabel = roleCommissionLabel(roleSlug);

  const progress = getUpgradeProgress({
    role: roleSlug,
    operationsCount: typeof ordersCount === "number" ? ordersCount : 0,
    userCreatedAt: profile?.created_at || null,
    now: new Date(),
  });

  const goTo = (sectionName) => {
    setActiveSection(sectionName);
    router.push(`/dashboard?section=${encodeURIComponent(sectionName)}`);
  };

  if (loading) {
    return (
      <div className="tix-container tix-section">
        <p className="text-slate-600">Cargando…</p>
      </div>
    );
  }

  return (
    <div className="tix-container tix-section">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">
            Hola, {profile?.full_name || "Usuario"} 👋
          </h1>
          <p className="text-slate-600 mt-1">
            Este es tu panel de cuenta en TixSwap.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
            onClick={() => router.push("/")}
          >
            Volver al inicio
          </button>

          <button
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
            onClick={() => router.push("/buy")}
          >
            Comprar
          </button>

          <button
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
            onClick={() => router.push("/sell")}
          >
            Vender
          </button>

          <button
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            onClick={handleLogout}
          >
            Cerrar sesión
          </button>
        </div>
      </div>

      {/* Layout */}
      <div className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Sidebar */}
        <div className="lg:col-span-3">
          <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
            <nav className="flex flex-col gap-1">
              {[
                "Resumen",
                "Mis datos",
                "Mis ventas",
                "Mis compras",
                "Mis calificaciones",
                "Wallet",
                "Soporte",
                "Mis tickets",
              ].map((item) => (
                <button
                  key={item}
                  onClick={() => goTo(item)}
                  className={`w-full text-left rounded-xl px-4 py-2 text-sm font-medium ${
                    activeSection === item
                      ? "bg-blue-600 text-white"
                      : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {item}
                </button>
              ))}

              {roleSlug === "admin" ? (
                <button
                  onClick={() => router.push("/admin/users")}
                  className={`w-full text-left rounded-xl px-4 py-2 text-sm font-medium ${
                    activeSection === "Admin"
                      ? "bg-blue-600 text-white"
                      : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  Admin
                </button>
              ) : null}
            </nav>
          </div>
        </div>

        {/* Main */}
        <div className="lg:col-span-9">
          {/* RESUMEN */}
          {activeSection === "Resumen" ? (
            <div className="grid grid-cols-1 gap-6">
              {/* Datos cuenta */}
              <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-slate-900">
                  Datos de la cuenta
                </h2>

                <div className="mt-4 text-sm text-slate-700 space-y-1">
                  <p>
                    <b>Correo:</b> {profile?.email || user?.email || "—"}
                  </p>
                  <p>
                    <b>RUT:</b> {profile?.rut || "—"}
                  </p>
                  <p>
                    <b>Teléfono:</b> {profile?.phone || "—"}
                  </p>

                  <p className="pt-2">
                    <b>Tipo de usuario:</b> {roleLabel}
                  </p>
                </div>

                {/* Progreso */}
                <div className="mt-5 rounded-2xl border border-slate-100 bg-slate-50 p-5">
                  <h3 className="text-sm font-semibold text-slate-900">
                    Tu progreso para subir de nivel
                  </h3>

                  {progress?.note ? (
                    <p className="mt-2 text-xs text-slate-600">{progress.note}</p>
                  ) : null}

                  {progress?.nextLabel ? (
                    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="rounded-xl border border-slate-200 bg-white p-4">
                        <p className="text-xs text-slate-500">Próximo nivel</p>
                        <p className="mt-1 font-semibold text-slate-900">
                          {progress.nextLabel}
                        </p>
                      </div>

                      <div className="rounded-xl border border-slate-200 bg-white p-4">
                        <p className="text-xs text-slate-500">Operaciones válidas</p>
                        {ordersCountError ? (
                          <p className="mt-1 text-sm text-slate-700">
                            {ordersCountError}
                          </p>
                        ) : (
                          <p className="mt-1 font-semibold text-slate-900">
                            {progress.opsDone} / {progress.opsRequired}
                            {progress.opsRemaining > 0 ? (
                              <span className="ml-2 text-xs text-slate-500 font-normal">
                                (faltan {progress.opsRemaining})
                              </span>
                            ) : null}
                          </p>
                        )}
                      </div>

                      <div className="rounded-xl border border-slate-200 bg-white p-4 md:col-span-2">
                        <p className="text-xs text-slate-500">Tiempo mínimo</p>
                        <p className="mt-1 font-semibold text-slate-900">
                          {progress.minMonths} meses
                          <span className="ml-2 text-xs text-slate-500 font-normal">
                            (llevas {progress.monthsOnPlatform} → faltan{" "}
                            {progress.monthsRemaining})
                          </span>
                        </p>

                        <div className="mt-3 text-xs text-slate-600">
                          <p>
                            ✔ Operaciones:{" "}
                            {progress.canUpgradeByOps ? "OK" : "Aún no"}
                          </p>
                          <p>
                            ✔ Tiempo: {progress.canUpgradeByTime ? "OK" : "Aún no"}
                          </p>
                          <p className="mt-2">
                            <b>
                              {progress.canUpgrade
                                ? "¡Ya cumples! (upgrade se puede aplicar en evaluación)"
                                : "Aún no cumples para subir."}
                            </b>
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-slate-700">
                      Estás en el nivel más alto disponible o tu rol es por invitación.
                    </p>
                  )}
                </div>
              </div>

              {/* Estado */}
              <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-slate-900">Estado</h2>
                <p className="mt-2 text-sm text-slate-600">
                  Más adelante aquí vas a ver:
                </p>
                <ul className="mt-3 text-sm text-slate-700 list-disc pl-5 space-y-1">
                  <li>Entradas en venta</li>
                  <li>Compras realizadas</li>
                  <li>Wallet y pagos programados</li>
                  <li>Reputación / calificaciones</li>
                </ul>
              </div>
            </div>
          ) : null}

          {/* MIS DATOS */}
          {activeSection === "Mis datos" ? (
            <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">Mis datos</h2>
              <p className="mt-2 text-sm text-slate-600">
                Pronto podrás editar tus datos aquí.
              </p>

              <div className="mt-4 text-sm text-slate-700 space-y-1">
                <p>
                  <b>Nombre:</b> {profile?.full_name || "—"}
                </p>
                <p>
                  <b>Correo:</b> {profile?.email || user?.email || "—"}
                </p>
                <p>
                  <b>RUT:</b> {profile?.rut || "—"}
                </p>
                <p>
                  <b>Teléfono:</b> {profile?.phone || "—"}
                </p>

                <p className="pt-2">
                  <b>Tipo de usuario:</b> {roleLabel}
                </p>
              </div>
            </div>
          ) : null}

          {/* WALLET */}
          {activeSection === "Wallet" ? (
            <WalletSection />
          ) : null}

          {/* PLACEHOLDERS */}
          {["Mis ventas", "Mis compras", "Mis calificaciones", "Soporte", "Mis tickets"].includes(
            activeSection
          ) ? (
            <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">
                {activeSection}
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                Esta sección estará disponible pronto.
              </p>
            </div>
          ) : null}

          {/* Admin hint */}
          {roleSlug === "admin" ? (
            <div className="mt-6 rounded-2xl border border-blue-100 bg-blue-50 p-5 text-sm text-slate-700">
              <b>Admin:</b> puedes administrar usuarios en{" "}
              <button
                className="underline font-semibold"
                onClick={() => router.push("/admin/users")}
              >
                /admin/users
              </button>
              .
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
