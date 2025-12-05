// app/dashboard/page.jsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabaseClient";

const SECTIONS = [
  { id: "overview", label: "Resumen" },
  { id: "profile", label: "Mis datos" },
  { id: "sales", label: "Mis ventas" },
  { id: "purchases", label: "Mis compras" },
  { id: "ratings", label: "Mis calificaciones" },
  { id: "wallet", label: "Wallet" },
  { id: "support", label: "Soporte" },
];

export default function DashboardPage() {
  const router = useRouter();

  const [currentSection, setCurrentSection] = useState("overview");
  const [user, setUser] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);

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

  // Perfil editable
  const [profileForm, setProfileForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    userType: "Usuario general",
  });
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [profileSuccess, setProfileSuccess] = useState("");

  // Cargar usuario + tickets
  useEffect(() => {
    const load = async () => {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (error) {
        console.error(error);
      }

      if (!user) {
        router.push("/login");
        return;
      }

      setUser(user);
      setLoadingUser(false);

      // Inicializar formulario de perfil
      const fullNameMeta =
        user.user_metadata?.name ||
        user.user_metadata?.full_name ||
        "";
      const rutMeta = user.user_metadata?.rut || "";
      const phoneMeta = user.user_metadata?.phone || "";
      const userTypeMeta = user.user_metadata?.userType || "Usuario general";

      setProfileForm({
        fullName: fullNameMeta,
        email: user.email || "",
        phone: phoneMeta,
        userType: userTypeMeta,
      });

      // Cargar tickets del usuario (RLS se encarga de filtrar)
      const { data: ticketsData, error: ticketsError } = await supabase
        .from("support_tickets")
        .select("*")
        .order("created_at", { ascending: false });

      if (ticketsError) {
        console.error(ticketsError);
        setTickets([]);
      } else {
        setTickets(ticketsData || []);
      }
      setLoadingTickets(false);
    };

    load();
  }, [router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const fullName =
    user?.user_metadata?.name || user?.user_metadata?.full_name || "Usuario";
  const rut = user?.user_metadata?.rut || "—";
  const phone = user?.user_metadata?.phone || "—";
  const userType = user?.user_metadata?.userType || "Usuario general";
  const email = user?.email || "—";

  // -------- Perfil: actualizar datos --------
  const handleProfileChange = (field) => (e) => {
    setProfileForm((prev) => ({
      ...prev,
      [field]: e.target.value,
    }));
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setProfileError("");
    setProfileSuccess("");

    if (!user) {
      setProfileError("Debes iniciar sesión para actualizar tus datos.");
      return;
    }

    if (!profileForm.email.trim()) {
      setProfileError("El correo no puede estar vacío.");
      return;
    }

    try {
      setSavingProfile(true);

      const { data, error } = await supabase.auth.updateUser({
        email: profileForm.email.trim(),
        data: {
          ...user.user_metadata,
          phone: profileForm.phone.trim(),
          userType: profileForm.userType,
        },
      });

      if (error) {
        console.error(error);
        setProfileError(
          "Ocurrió un problema al actualizar tus datos. Intenta de nuevo."
        );
        return;
      }

      if (data?.user) {
        setUser(data.user);
      }

      setProfileSuccess("Tus datos fueron actualizados correctamente.");
    } catch (err) {
      console.error(err);
      setProfileError(
        "Ocurrió un problema al actualizar tus datos. Intenta de nuevo."
      );
    } finally {
      setSavingProfile(false);
    }
  };

  // -------- Soporte: crear ticket --------
  const handleTicketChange = (field) => (e) => {
    setTicketForm((prev) => ({ ...prev, [field]: e.target.value }));
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
          // status por defecto 'open'
        },
      ]);

      if (error) {
        console.error(error);
        setTicketError(
          "Ocurrió un problema al crear tu ticket. Intenta de nuevo en unos minutos."
        );
        return;
      }

      // Recargar tickets
      const { data: ticketsData, error: ticketsError } = await supabase
        .from("support_tickets")
        .select("*")
        .order("created_at", { ascending: false });

      if (!ticketsError && ticketsData) {
        setTickets(ticketsData);
      }

      // Limpiar formulario
      setTicketForm({
        category: "soporte",
        subject: "",
        message: "",
      });

      setTicketSuccess("Tu solicitud fue enviada correctamente. 🎫");
    } finally {
      setSubmittingTicket(false);
    }
  };

  // -------- Render de secciones --------
  const renderSection = () => {
    if (currentSection === "overview") {
      return (
        <div className="grid gap-6 md:grid-cols-2">
          <div className="bg-white shadow-sm rounded-2xl p-6 border border-slate-100">
            <h2 className="text-lg font-semibold mb-4">Datos de la cuenta</h2>
            <p className="text-sm text-slate-700">
              <span className="font-medium">Correo:</span> {email}
            </p>
            <p className="text-sm text-slate-700">
              <span className="font-medium">RUT:</span> {rut}
            </p>
            <p className="text-sm text-slate-700">
              <span className="font-medium">Teléfono:</span> {phone}
            </p>
            <p className="text-sm text-slate-700">
              <span className="font-medium">Tipo de usuario:</span> {userType}
            </p>
          </div>

          <div className="bg-white shadow-sm rounded-2xl p-6 border border-slate-100">
            <h2 className="text-lg font-semibold mb-4">Estado</h2>
            <p className="text-sm text-slate-700 mb-2">
              Por ahora este es un resumen simple de tu cuenta. Más adelante
              aquí vas a ver:
            </p>
            <ul className="list-disc list-inside text-sm text-slate-700 space-y-1">
              <li>Entradas en venta</li>
              <li>Compras realizadas</li>
              <li>Verificación de identidad / medios de pago</li>
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
            Por seguridad, el nombre y el RUT no se pueden modificar desde el
            panel. Si necesitas actualizar alguno de esos datos, escríbenos a{" "}
            <a
              href="mailto:soporte@tixswap.cl"
              className="text-blue-600 hover:underline"
            >
              soporte@tixswap.cl
            </a>
            .
          </p>

          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Nombre completo
              </label>
              <input
                type="text"
                value={profileForm.fullName}
                disabled
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 text-slate-500"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  RUT
                </label>
                <input
                  type="text"
                  value={rut}
                  disabled
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 text-slate-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Tipo de usuario
                </label>
                <select
                  value={profileForm.userType}
                  onChange={handleProfileChange("userType")}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Usuario general">Usuario general</option>
                  <option value="Vendedor frecuente">Vendedor frecuente</option>
                  <option value="Comprador frecuente">
                    Comprador frecuente
                  </option>
                  <option value="Usuario verificado">Usuario verificado</option>
                </select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Correo electrónico
                </label>
                <input
                  type="email"
                  value={profileForm.email}
                  onChange={handleProfileChange("email")}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="tucorreo@ejemplo.cl"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Teléfono
                </label>
                <input
                  type="tel"
                  value={profileForm.phone}
                  onChange={handleProfileChange("phone")}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="+56 9 ..."
                />
              </div>
            </div>

            {profileError && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                {profileError}
              </p>
            )}

            {profileSuccess && (
              <p className="text-sm text-green-700 bg-green-50 border border-green-100 rounded-lg px-3 py-2">
                {profileSuccess}
              </p>
            )}

            <button
              type="submit"
              disabled={savingProfile}
              className="inline-flex items-center justify-center px-4 py-2 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {savingProfile ? "Guardando..." : "Guardar cambios"}
            </button>
          </form>
        </div>
      );
    }

    if (currentSection === "sales") {
      return (
        <PlaceholderCard title="Mis ventas">
          Aquí vas a poder ver todas las entradas que hayas publicado, el
          comprador, la fecha de la venta y las calificaciones que recibas
          como vendedor.
        </PlaceholderCard>
      );
    }

    if (currentSection === "purchases") {
      return (
        <PlaceholderCard title="Mis compras">
          Aquí vas a ver todas las entradas que compraste, estado del evento,
          vendedor y tus calificaciones como comprador.
        </PlaceholderCard>
      );
    }

    if (currentSection === "ratings") {
      return (
        <PlaceholderCard title="Mis calificaciones">
          Aquí se mostrará tu nivel como comprador y vendedor (estrellas) y el
          detalle de las evaluaciones recibidas.
        </PlaceholderCard>
      );
    }

    if (currentSection === "wallet") {
      return (
        <PlaceholderCard title="Wallet">
          Aquí verás tu saldo disponible, saldo a liberar y el historial de
          movimientos de tu cuenta.
        </PlaceholderCard>
      );
    }

    if (currentSection === "support") {
      const lastTickets = tickets.slice(0, 2);

      return (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1.3fr)]">
          {/* Formulario */}
          <div className="bg-white shadow-sm rounded-2xl p-6 border border-slate-100">
            <h2 className="text-lg font-semibold mb-4">
              Crear solicitud de soporte
            </h2>
            <p className="text-sm text-slate-500 mb-4">
              Si tuviste un problema con una compra, venta o con tu cuenta,
              cuéntanos los detalles y te vamos a ayudar lo antes posible.
            </p>

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
                  <option value="sugerencia">Sugerencia para TixSwap</option>
                  <option value="reclamo">Reclamo para TixSwap</option>
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
                  placeholder="Cuéntanos qué pasó, incluye fechas, evento y toda la información que tengas."
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

          {/* Lista de tickets (últimos) */}
          <div className="bg-white shadow-sm rounded-2xl p-6 border border-slate-100">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-lg font-semibold">Mis tickets</h2>
              {loadingTickets ? (
                <span className="text-xs text-slate-400">Cargando…</span>
              ) : (
                <span className="text-xs text-slate-400">
                  {tickets.length} ticket
                  {tickets.length === 1 ? "" : "s"}
                </span>
              )}
            </div>

            {!loadingTickets && tickets.length > 0 && (
              <p className="text-[11px] text-slate-400 mb-3">
                Mostrando tus últimos {lastTickets.length} tickets.
              </p>
            )}

            {loadingTickets ? (
              <p className="text-sm text-slate-500">
                Cargando tus solicitudes de soporte…
              </p>
            ) : tickets.length === 0 ? (
              <p className="text-sm text-slate-500">
                Aún no has creado tickets de soporte. Cuando envíes uno, lo
                vas a ver aquí con su estado.
              </p>
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
                          <span className="font-semibold">
                            Respuesta de soporte:{" "}
                          </span>
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
              <p className="text-xs text-slate-500">
                Aquí puedes revisar el historial completo de tus solicitudes de
                soporte.
              </p>
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
            <p className="text-sm text-slate-500">
              Cargando tus solicitudes de soporte…
            </p>
          ) : tickets.length === 0 ? (
            <p className="text-sm text-slate-500">
              Aún no has creado tickets de soporte.
            </p>
          ) : (
            <ul className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
              {tickets.map((t) => (
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
                  <p className="text-xs text-slate-600 mb-1 whitespace-pre-wrap">
                    {t.message}
                  </p>
                  {t.admin_response && (
                    <p className="text-[11px] text-slate-500 border-t border-slate-100 pt-1 mt-1">
                      <span className="font-semibold">
                        Respuesta de soporte:{" "}
                      </span>
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

    return null;
  };

  if (loadingUser) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-sm text-slate-500">Cargando tu cuenta…</p>
      </main>
    );
  }

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

          {/* BOTONES SUPERIORES */}
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
              onClick={() => router.push("/")}
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
          {/* Sidebar */}
          <aside className="w-full md:w-60 bg-white border border-slate-100 rounded-2xl p-3 shadow-sm">
            <nav className="space-y-1">
              {SECTIONS.map((section) => (
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

          {/* Contenido */}
          <section className="flex-1">{renderSection()}</section>
        </div>
      </div>
    </main>
  );
}

// ---- Componentes auxiliares ----

function PlaceholderCard({ title, children }) {
  return (
    <div className="bg-white shadow-sm rounded-2xl p-6 border border-slate-100">
      <h2 className="text-lg font-semibold mb-3">{title}</h2>
      <p className="text-sm text-slate-500 mb-2">{children}</p>
      <p className="text-xs text-slate-400">
        Esta sección está en construcción para el MVP. Más adelante aquí se
        verá la información en detalle.
      </p>
    </div>
  );
}

function StatusPill({ status }) {
  const base =
    "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium";

  const map = {
    open: base + " bg-amber-50 text-amber-700 border border-amber-100",
    in_progress:
      base + " bg-blue-50 text-blue-700 border border-blue-100",
    closed:
      base + " bg-emerald-50 text-emerald-700 border border-emerald-100",
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
  if (category === "sugerencia") return "Sugerencia para TixSwap";
  if (category === "reclamo") return "Reclamo para TixSwap";
  if (category === "otro") return "Otro";
  return category || "—";
}
