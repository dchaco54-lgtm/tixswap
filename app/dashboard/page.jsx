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

  // --- Soporte: crear ticket ---
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
          // status se va por defecto en 'open'
        },
      ]);

      if (error) {
        console.error(error);
        setTicketError(
          "Ocurrió un problema al crear tu ticket. Intenta de nuevo en unos minutos."
        );
        return;
      }

      // Volver a cargar la lista de tickets
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
        <div className="bg-white shadow-sm rounded-2xl p-6 border border-slate-100">
          <h2 className="text-lg font-semibold mb-4">Mis datos</h2>
          <p className="text-sm text-slate-500 mb-4">
            Por seguridad, el nombre y el RUT no se pueden modificar desde el
            panel. Si necesitas actualizar algún dato, escríbenos a{" "}
            <a
              href="mailto:soporte@tixswap.cl"
              className="text-blue-600 hover:underline"
            >
              soporte@tixswap.cl
            </a>
            .
          </p>
          <div className="space-y-2 text-sm text-slate-700">
            <p>
              <span className="font-medium">Nombre completo:</span> {fullName}
            </p>
            <p>
              <span className="font-medium">RUT:</span> {rut}
            </p>
            <p>
              <span className="font-medium">Correo:</span> {email}
            </p>
            <p>
              <span className="font-medium">Teléfono:</span> {phone}
            </p>
            <p>
              <span className="font-medium">Tipo de usuario:</span> {userType}
            </p>
          </div>
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

          {/* Lista de tickets */}
          <div className="bg-white shadow-sm rounded-2xl p-6 border border-slate-100">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Mis tickets</h2>
              {loadingTickets ? (
                <span className="text-xs text-s

::contentReference[oaicite:0]{index=0}


