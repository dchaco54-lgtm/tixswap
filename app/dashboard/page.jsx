// app/dashboard/page.jsx
"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../lib/supabaseClient";
import WalletSection from "./WalletSection";
import {
  normalizeRole,
  roleCommissionLabel,
  getUpgradeProgress,
  ORDER_COUNT_STATUSES,
} from "@/lib/roles";

const BASE_SECTIONS = [
  { id: "overview", label: "Resumen" },
  { id: "profile", label: "Mis datos" },
  { id: "sales", label: "Mis ventas" },
  { id: "purchases", label: "Mis compras" },
  { id: "ratings", label: "Mis calificaciones" },
  { id: "wallet", label: "Wallet" },
  { id: "support", label: "Soporte" },
  { id: "tickets", label: "Mis tickets" },
];

export default function DashboardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [currentSection, setCurrentSection] = useState("overview");
  const [user, setUser] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);

  // Perfil desde DB (fuente principal)
  const [profileRow, setProfileRow] = useState(null); // { email, phone, rut, full_name, role, created_at }
  const [isAdmin, setIsAdmin] = useState(false);
  const [userRole, setUserRole] = useState("basic");

  // Progreso upgrade
  const [operationsCount, setOperationsCount] = useState(null);
  const [loadingOps, setLoadingOps] = useState(false);

  // Mis datos (editable solo email/phone)
  const [profileForm, setProfileForm] = useState({ email: "", phone: "" });
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [profileSuccess, setProfileSuccess] = useState("");

  // Soporte
  const [tickets, setTickets] = useState([]);
  const [loadingTickets, setLoadingTickets] = useState(true);
  const [ticketForm, setTicketForm] = useState({
    category: "soporte",
    subject: "",
    message: "",
  });
  const [submittingTicket, setSubmittingTicket] = useState(false);
  const [ticketError, setTicketError] = useState("");
  const [ticketSuccess, setTicketSuccess] = useState("");

  // Deep link /dashboard?section=wallet
  useEffect(() => {
    const section = searchParams?.get("section");
    if (!section) return;
    const exists =
      BASE_SECTIONS.some((s) => s.id === section) || section === "admin";
    if (exists) setCurrentSection(section);
  }, [searchParams]);

  useEffect(() => {
    const load = async () => {
      setLoadingUser(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      setUser(user);

      // 1) Cargar perfiles completos (DB)
      const { data: prof, error: profErr } = await supabase
        .from("profiles")
        .select("id, email, phone, rut, full_name, role, created_at")
        .eq("id", user.id)
        .maybeSingle();

      if (profErr) console.warn(profErr);

      setProfileRow(prof || null);

      const roleFromProfile = normalizeRole(prof?.role || "basic");
      setUserRole(roleFromProfile);
      setIsAdmin(roleFromProfile === "admin");

      // 2) Prefill form (email/phone)
      setProfileForm({
        email: (prof?.email || user.email || "").trim(),
        phone: (prof?.phone || user.user_metadata?.phone || "").trim(),
      });

      // 3) Contar operaciones (si falla por RLS, queda null)
      try {
        setLoadingOps(true);

        const { count: sellerCount, error: sErr } = await supabase
          .from("orders")
          .select("id", { count: "exact", head: true })
          .eq("seller_id", user.id)
          .in("status", ORDER_COUNT_STATUSES);

        const { count: buyerCount, error: bErr } = await supabase
          .from("orders")
          .select("id", { count: "exact", head: true })
          .eq("buyer_id", user.id)
          .in("status", ORDER_COUNT_STATUSES);

        if (sErr || bErr) {
          console.warn("No se pudo contar operaciones:", sErr || bErr);
          setOperationsCount(null);
        } else {
          setOperationsCount((sellerCount || 0) + (buyerCount || 0));
        }
      } catch (e) {
        console.warn("No se pudo contar operaciones:", e);
        setOperationsCount(null);
      } finally {
        setLoadingOps(false);
      }

      // 4) Tickets
      setLoadingTickets(true);
      const { data: ticketsData, error: ticketsErr } = await supabase
        .from("support_tickets")
        .select("*")
        .order("created_at", { ascending: false });

      if (ticketsErr) {
        console.warn(ticketsErr);
        setTickets([]);
      } else {
        setTickets(ticketsData || []);
      }
      setLoadingTickets(false);

      setLoadingUser(false);
    };

    load();
  }, [router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  // Valores para mostrar (DB -> fallback metadata)
  const fullName =
    profileRow?.full_name ||
    user?.user_metadata?.name ||
    user?.user_metadata?.full_name ||
    user?.user_metadata?.fullName ||
    "Usuario";

  const rut = profileRow?.rut || user?.user_metadata?.rut || "—";
  const phoneDisplay = profileRow?.phone || user?.user_metadata?.phone || "—";
  const emailDisplay = profileRow?.email || user?.email || "—";

  const displayedUserType = roleCommissionLabel(isAdmin ? "admin" : userRole);

  // ------ Mis datos: cambios ------
  const handleProfileField = (field) => (e) => {
    setProfileForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setProfileError("");
    setProfileSuccess("");

    if (!user) {
      setProfileError("Debes iniciar sesión.");
      return;
    }

    const newEmail = (profileForm.email || "").trim();
    const newPhone = (profileForm.phone || "").trim();

    if (!newEmail) {
      setProfileError("El correo no puede estar vacío.");
      return;
    }

    try {
      setSavingProfile(true);

      // 1) Guardar en profiles (fuente de tu web)
      const { error: upErr } = await supabase
        .from("profiles")
        .update({ email: newEmail, phone: newPhone })
        .eq("id", user.id);

      if (upErr) {
        console.error(upErr);
        setProfileError("No se pudo guardar en tu perfil. Intenta de nuevo.");
        return;
      }

      // 2) Si cambió el correo, actualizar Auth (solo para el usuario actual)
      //    (Supabase usualmente envía mail de confirmación)
      const currentAuthEmail = (user.email || "").trim().toLowerCase();
      if (newEmail.toLowerCase() !== currentAuthEmail) {
        const { data, error: authErr } = await supabase.auth.updateUser({
          email: newEmail,
          // Mantenemos metadata existente, solo actualizamos phone
          data: { ...user.user_metadata, phone: newPhone },
        });

        if (authErr) {
          console.warn(authErr);
          // Ojo: el perfil se guardó igual. Avisamos sin romper.
          setProfileSuccess(
            "Guardado en tu perfil. Ojo: el cambio de correo de inicio de sesión puede requerir confirmación por email."
          );
        } else {
          if (data?.user) setUser(data.user);
          setProfileSuccess(
            "Listo ✅ Se guardó tu correo/teléfono. Si cambiaste el correo, revisa tu email para confirmar."
          );
        }
      } else {
        // solo phone (y además metadata phone para coherencia)
        const { data, error: metaErr } = await supabase.auth.updateUser({
          data: { ...user.user_metadata, phone: newPhone },
        });
        if (!metaErr && data?.user) setUser(data.user);

        setProfileSuccess("Listo ✅ Se guardó tu teléfono.");
      }

      // Refrescar profileRow local
      setProfileRow((prev) => ({
        ...(prev || {}),
        email: newEmail,
        phone: newPhone,
      }));
    } catch (err) {
      console.error(err);
      setProfileError("Ocurrió un error guardando tus datos.");
    } finally {
      setSavingProfile(false);
    }
  };

  // ------ Soporte ------
  const handleTicketChange = (field) => (e) => {
    const value = e.target.value;
    setTicketForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleCreateTicket = async (e) => {
    e.preventDefault();
    setTicketError("");
    setTicketSuccess("");

    if (!ticketForm.subject.trim() || !ticketForm.message.trim()) {
      setTicketError("Debes escribir un asunto y un mensaje.");
      return;
    }

    if (!user) {
      setTicketError("Debes iniciar sesión para crear un ticket.");
      return;
    }

    try {
      setSubmittingTicket(true);

      const { error } = await supabase.from("support_tickets").insert([
        {
          user_id: user.id,
          category: ticketForm.category,
          subject: ticketForm.subject.trim(),
          message: ticketForm.message.trim(),
        },
      ]);

      if (error) {
        console.error(error);
        setTicketError("No se pudo crear el ticket. Intenta más tarde.");
        return;
      }

      const { data: ticketsData } = await supabase
        .from("support_tickets")
        .select("*")
        .order("created_at", { ascending: false });

      setTickets(ticketsData || []);

      setTicketForm({ category: "soporte", subject: "", message: "" });
      setTicketSuccess("Tu solicitud fue enviada correctamente. 🎫");
    } finally {
      setSubmittingTicket(false);
    }
  };

  // ------ Render ------
  const renderSection = () => {
    if (currentSection === "overview") {
      return (
        <div className="grid gap-6 md:grid-cols-2">
          <div className="bg-white shadow-sm rounded-2xl p-6 border border-slate-100">
            <h2 className="text-lg font-semibold mb-4">Datos de la cuenta</h2>

            <p className="text-sm text-slate-700">
              <span className="font-medium">Correo:</span> {emailDisplay}
            </p>
            <p className="text-sm text-slate-700">
              <span className="font-medium">RUT:</span> {rut}
            </p>
            <p className="text-sm text-slate-700">
              <span className="font-medium">Teléfono:</span> {phoneDisplay}
            </p>
            <p className="text-sm text-slate-700">
              <span className="font-medium">Tipo de usuario:</span>{" "}
              {displayedUserType}
            </p>

            <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
              {(() => {
                const prog = getUpgradeProgress({
                  role: isAdmin ? "admin" : userRole,
                  operationsCount: operationsCount ?? 0,
                  userCreatedAt: profileRow?.created_at || user?.created_at || null,
                });

                if (!prog.nextLabel) {
                  return (
                    <div className="text-sm text-slate-700">
                      <p className="font-medium">{prog.currentLabel}</p>
                      {prog.note ? (
                        <p className="mt-1 text-xs text-slate-500">{prog.note}</p>
                      ) : null}
                    </div>
                  );
                }

                return (
                  <div className="text-sm text-slate-700">
                    <p className="font-medium">Próximo nivel: {prog.nextLabel}</p>

                    <div className="mt-2 text-xs text-slate-600 space-y-1">
                      <p>
                        Operaciones válidas:{" "}
                        <b>{operationsCount === null ? "—" : prog.opsDone}</b>
                        {" / "}
                        <b>{prog.opsRequired}</b>
                        {operationsCount === null ? (
                          <span className="ml-2 text-slate-500">(pronto)</span>
                        ) : (
                          <span className="ml-2 text-slate-500">
                            (faltan {prog.opsRemaining})
                          </span>
                        )}
                      </p>

                      <p>
                        Tiempo mínimo: <b>{prog.minMonths} meses</b>{" "}
                        {prog.monthsOnPlatform !== null ? (
                          <span className="text-slate-500">
                            (llevas {prog.monthsOnPlatform}, faltan {prog.monthsRemaining})
                          </span>
                        ) : null}
                      </p>

                      <p className="text-slate-500">
                        {loadingOps ? "Calculando progreso..." : "Upgrades en ventanas: cada 3 meses."}
                      </p>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>

          <div className="bg-white shadow-sm rounded-2xl p-6 border border-slate-100">
            <h2 className="text-lg font-semibold mb-4">Estado</h2>
            <p className="text-sm text-slate-700 mb-2">
              Más adelante aquí vas a ver:
            </p>
            <ul className="list-disc list-inside text-sm text-slate-700 space-y-1">
              <li>Entradas en venta</li>
              <li>Compras realizadas</li>
              <li>Wallet y pagos programados</li>
              <li>Reputación / calificaciones</li>
            </ul>
          </div>
        </div>
      );
    }

    if (currentSection === "profile") {
      return (
        <div className="bg-white shadow-sm rounded-2xl p-6 border border-slate-100 max-w-2xl">
          <h2 className="text-lg font-semibold mb-4">Mis datos</h2>

          <p className="text-sm text-slate-500 mb-4">
            Puedes actualizar tu <b>correo</b> y <b>teléfono</b>. Por seguridad, <b>nombre</b> y <b>RUT</b> solo los modifica el Admin.
          </p>

          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Nombre completo
              </label>
              <input
                value={fullName}
                disabled
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 text-slate-600"
              />
              <p className="mt-1 text-xs text-slate-500">
                Este dato solo lo puede cambiar el Admin.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  RUT
                </label>
                <input
                  value={rut}
                  disabled
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 text-slate-600"
                />
                <p className="mt-1 text-xs text-slate-500">
                  Este dato solo lo puede cambiar el Admin.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Tipo de usuario
                </label>
                <input
                  value={displayedUserType}
                  disabled
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 text-slate-600"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Correo
                </label>
                <input
                  type="email"
                  value={profileForm.email}
                  onChange={handleProfileField("email")}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="tucorreo@ejemplo.com"
                />
                <p className="mt-1 text-xs text-slate-500">
                  Si cambias el correo, puede requerir confirmación por email.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Teléfono
                </label>
                <input
                  type="tel"
                  value={profileForm.phone}
                  onChange={handleProfileField("phone")}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="+56 9 ..."
                />
              </div>
            </div>

            {profileError ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {profileError}
              </div>
            ) : null}

            {profileSuccess ? (
              <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                {profileSuccess}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={savingProfile}
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {savingProfile ? "Guardando..." : "Guardar cambios"}
            </button>

            {isAdmin ? (
              <div className="mt-3 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-slate-700">
                <b>Admin:</b> para editar usuarios (correo/teléfono/rol) entra a{" "}
                <button
                  className="underline font-semibold"
                  type="button"
                  onClick={() => router.push("/admin/users")}
                >
                  /admin/users
                </button>
                .
              </div>
            ) : null}
          </form>
        </div>
      );
    }

    if (currentSection === "wallet") {
      return <WalletSection user={user} />;
    }

    if (currentSection === "support") {
      const lastTickets = tickets.slice(0, 2);

      return (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1.3fr)]">
          <div className="bg-white shadow-sm rounded-2xl p-6 border border-slate-100">
            <h2 className="text-lg font-semibold mb-4">Crear solicitud de soporte</h2>

            <form onSubmit={handleCreateTicket} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Categoría
                </label>
                <select
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={ticketForm.category}
                  onChange={handleTicketChange("category")}
                >
                  <option value="soporte">Soporte general</option>
                  <option value="disputa">Disputa por compra/venta</option>
                  <option value="sugerencia">Sugerencia</option>
                  <option value="reclamo">Reclamo</option>
                  <option value="otro">Otro</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Asunto
                </label>
                <input
                  type="text"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Ej: Problema con entrada de concierto X"
                  value={ticketForm.subject}
                  onChange={handleTicketChange("subject")}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Mensaje
                </label>
                <textarea
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[120px]"
                  placeholder="Cuéntanos qué pasó..."
                  value={ticketForm.message}
                  onChange={handleTicketChange("message")}
                />
              </div>

              {ticketError && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                  {ticketError}
                </p>
              )}

              {ticketSuccess && (
                <p className="text-sm text-green-700 bg-green-50 border border-green-100 rounded-lg px-3 py-2">
                  {ticketSuccess}
                </p>
              )}

              <button
                type="submit"
                disabled={submittingTicket}
                className="inline-flex items-center justify-center w-full md:w-auto px-4 py-2 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {submittingTicket ? "Enviando..." : "Enviar solicitud"}
              </button>
            </form>
          </div>

          <div className="bg-white shadow-sm rounded-2xl p-6 border border-slate-100">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-lg font-semibold">Mis tickets</h2>
              {loadingTickets ? (
                <span className="text-xs text-slate-400">Cargando…</span>
              ) : (
                <span className="text-xs text-slate-400">
                  {tickets.length} ticket{tickets.length === 1 ? "" : "s"}
                </span>
              )}
            </div>

            {loadingTickets ? (
              <p className="text-sm text-slate-500">Cargando tickets…</p>
            ) : tickets.length === 0 ? (
              <p className="text-sm text-slate-500">Aún no has creado tickets.</p>
            ) : (
              <>
                <ul className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
                  {lastTickets.map((t) => (
                    <li
                      key={t.id}
                      className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <p className="font-medium text-slate-800 truncate">
                          {t.subject}
                        </p>
                        <StatusPill status={t.status} />
                      </div>
                      <p className="text-xs text-slate-500 mb-1">
                        {formatCategory(t.category)} ·{" "}
                        {new Date(t.created_at).toLocaleString("es-CL", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </p>
                      <p className="text-xs text-slate-600 line-clamp-2 mb-1">
                        {t.message}
                      </p>
                      {t.admin_response && (
                        <p className="text-[11px] text-slate-500 border-t border-slate-100 pt-1 mt-1">
                          <span className="font-semibold">Respuesta: </span>
                          {t.admin_response}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>

                <button
                  type="button"
                  onClick={() => setCurrentSection("tickets")}
                  className="mt-4 text-xs font-medium text-blue-600 hover:text-blue-700"
                >
                  Ver todos mis tickets →
                </button>
              </>
            )}
          </div>
        </div>
      );
    }

    if (currentSection === "tickets") {
      return (
        <div className="bg-white shadow-sm rounded-2xl p-6 border border-slate-100">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold">Todos mis tickets</h2>
              <p className="text-xs text-slate-500">Historial completo.</p>
            </div>
            <button
              type="button"
              onClick={() => setCurrentSection("support")}
              className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100"
            >
              ← Volver a soporte
            </button>
          </div>

          {loadingTickets ? (
            <p className="text-sm text-slate-500">Cargando…</p>
          ) : tickets.length === 0 ? (
            <p className="text-sm text-slate-500">No hay tickets.</p>
          ) : (
            <ul className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
              {tickets.map((t) => (
                <li key={t.id} className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm">
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-medium text-slate-800 truncate">{t.subject}</p>
                    <StatusPill status={t.status} />
                  </div>
                  <p className="text-xs text-slate-500 mb-1">
                    {formatCategory(t.category)} ·{" "}
                    {new Date(t.created_at).toLocaleString("es-CL", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </p>
                  <p className="text-xs text-slate-600 whitespace-pre-wrap">{t.message}</p>
                  {t.admin_response && (
                    <p className="text-[11px] text-slate-500 border-t border-slate-100 pt-1 mt-1">
                      <span className="font-semibold">Respuesta: </span>
                      {t.admin_response}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      );
    }

    if (currentSection === "admin" && isAdmin) {
      return (
        <div className="grid gap-6 md:grid-cols-3">
          <AdminCard
            title="Eventos"
            desc="Gestor de eventos."
            onClick={() => router.push("/admin/events")}
            button="Abrir gestor de eventos"
          />
          <AdminCard
            title="Tickets de soporte"
            desc="Revisar solicitudes."
            onClick={() => router.push("/admin/support")}
            button="Ver tickets de soporte"
          />
          <AdminCard
            title="Usuarios"
            desc="Administración de usuarios."
            onClick={() => router.push("/admin/users")}
            button="Administrar usuarios"
          />
        </div>
      );
    }

    // placeholders
    if (["sales", "purchases", "ratings"].includes(currentSection)) {
      const map = {
        sales: { t: "Mis ventas", d: "Próximamente: tus ventas y estado de pago." },
        purchases: { t: "Mis compras", d: "Próximamente: historial de compras y reclamos." },
        ratings: { t: "Mis calificaciones", d: "Próximamente: reputación comprador/vendedor." },
      };
      return <PlaceholderCard title={map[currentSection].t}>{map[currentSection].d}</PlaceholderCard>;
    }

    return null;
  };

  if (loadingUser) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-sm text-slate-500">Cargando tu cuenta…</p>
      </main>
    );
  }

  const sidebarSections = isAdmin
    ? [...BASE_SECTIONS, { id: "admin", label: "Admin" }]
    : BASE_SECTIONS;

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto px-4 py-10 md:py-12">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold text-slate-900">
              Hola, {fullName} 👋
            </h1>
            <p className="text-sm text-slate-500">
              Este es tu panel de cuenta en TixSwap.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => router.push("/")}
              className="text-sm px-4 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50"
            >
              Volver al inicio
            </button>
            <button
              onClick={() => router.push("/")}
              className="text-sm px-4 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50"
            >
              Comprar
            </button>
            <button
              onClick={() => router.push("/sell")}
              className="text-sm px-4 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50"
            >
              Vender
            </button>
            <button
              onClick={handleLogout}
              className="text-sm px-4 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50"
            >
              Cerrar sesión
            </button>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-6">
          <aside className="w-full md:w-60 bg-white border border-slate-100 rounded-2xl p-3 shadow-sm">
            <nav className="space-y-1">
              {sidebarSections.map((section) => (
                <button
                  key={section.id}
                  onClick={() => setCurrentSection(section.id)}
                  className={`w-full text-left px-3 py-2 rounded-xl text-sm ${
                    currentSection === section.id
                      ? "bg-blue-600 text-white"
                      : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {section.label}
                </button>
              ))}
            </nav>
          </aside>

          <section className="flex-1">{renderSection()}</section>
        </div>
      </div>
    </main>
  );
}

function AdminCard({ title, desc, onClick, button }) {
  return (
    <div className="bg-white shadow-sm rounded-2xl p-6 border border-slate-100">
      <h2 className="text-lg font-semibold mb-2">{title}</h2>
      <p className="text-sm text-slate-500 mb-4">{desc}</p>
      <button
        type="button"
        onClick={onClick}
        className="text-sm px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
      >
        {button}
      </button>
    </div>
  );
}

function PlaceholderCard({ title, children }) {
  return (
    <div className="bg-white shadow-sm rounded-2xl p-6 border border-slate-100">
      <h2 className="text-lg font-semibold mb-3">{title}</h2>
      <p className="text-sm text-slate-500 mb-2">{children}</p>
      <p className="text-xs text-slate-400">Esta sección está en construcción para el MVP.</p>
    </div>
  );
}

function StatusPill({ status }) {
  const base = "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium";
  const map = {
    open: base + " bg-amber-50 text-amber-700 border border-amber-100",
    in_progress: base + " bg-blue-50 text-blue-700 border border-blue-100",
    closed: base + " bg-emerald-50 text-emerald-700 border border-emerald-100",
  };
  return <span className={map[status] || base}>{formatStatus(status)}</span>;
}

function formatStatus(status) {
  if (status === "open") return "Abierto";
  if (status === "in_progress") return "En revisión";
  if (status === "closed") return "Cerrado";
  return status || "—";
}

function formatCategory(category) {
  if (category === "soporte") return "Soporte general";
  if (category === "disputa") return "Disputa por compra/venta";
  if (category === "sugerencia") return "Sugerencia";
  if (category === "reclamo") return "Reclamo";
  if (category === "otro") return "Otro";
  return category || "—";
}
