"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import supabase from "@/lib/supabaseClient";

export default function AdminPage() {
  const router = useRouter();

  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(true);

  const [events, setEvents] = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(false);

  const [tickets, setTickets] = useState([]);
  const [ticketsByStatus, setTicketsByStatus] = useState({
    open: [],
    in_progress: [],
    closed: [],
  });
  const [loadingTickets, setLoadingTickets] = useState(false);

  // ✅ Emails que SIEMPRE serán admin (backup por si se te desordena profiles)
  const ADMIN_EMAIL_ALLOWLIST = useMemo(
    () => ["soporte@tixswap.cl"],
    []
  );

  useEffect(() => {
    (async () => {
      try {
        setCheckingAdmin(true);

        const { data: sessionData } = await supabase.auth.getSession();
        const session = sessionData?.session;
        if (!session) {
          router.push("/login");
          return;
        }

        const { data: userData } = await supabase.auth.getUser();
        const user = userData?.user;
        if (!user) {
          router.push("/login");
          return;
        }

        // Traemos perfil
        const { data: prof } = await supabase
          .from("profiles")
          .select("user_type, app_role, email")
          .eq("id", user.id)
          .maybeSingle();

        const user_type = (prof?.user_type || "").toString().toLowerCase();
        const app_role = (prof?.app_role || "").toString().toLowerCase();
        const email =
          (prof?.email || user.email || "").toString().toLowerCase().trim();

        const isAdminByRole = user_type === "admin" || app_role === "admin";
        const isAdminByEmail = ADMIN_EMAIL_ALLOWLIST.includes(email);

        // Log útil (puedes borrarlo después)
        console.log("Validación Admin:", {
          user_type,
          app_role,
          email,
          isAdminByRole,
          isAdminByEmail,
        });

        const allowed = isAdminByRole || isAdminByEmail;
        setIsAdmin(allowed);

        if (!allowed) {
          router.push("/dashboard");
          return;
        }

        // Cargar datos admin
        loadEvents();
        loadTickets();
      } catch (e) {
        console.error("Error validando admin:", e);
        router.push("/dashboard");
      } finally {
        setCheckingAdmin(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadEvents() {
    try {
      setLoadingEvents(true);
      const { data, error } = await supabase
        .from("events")
        .select("id, title, starts_at, venue, city")
        .order("starts_at", { ascending: true })
        .limit(50);

      if (error) throw error;
      setEvents(data || []);
    } catch (e) {
      console.error("Error cargando eventos:", e);
      setEvents([]);
    } finally {
      setLoadingEvents(false);
    }
  }

  async function loadTickets() {
    try {
      setLoadingTickets(true);

      // ✅ FIX: support_tickets NO tiene email, tiene requester_email
      const { data, error } = await supabase
        .from("support_tickets")
        .select("id, requester_email, subject, status, created_at")
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;

      const rows = data || [];
      setTickets(rows);

      // ✅ FIX: Normalizamos estados (tu sistema usa submitted/in_review/waiting_user/resolved/rejected)
      const toLower = (v) => (v || "").toString().toLowerCase().trim();

      const isOpen = (s) => ["submitted", "open", "new"].includes(toLower(s));
      const isInProgress = (s) =>
        ["in_review", "in_progress", "waiting_user", "pending"].includes(
          toLower(s)
        );
      const isClosed = (s) =>
        ["resolved", "closed", "rejected"].includes(toLower(s));

      const grouped = {
        open: rows.filter((t) => isOpen(t.status)),
        in_progress: rows.filter((t) => isInProgress(t.status)),
        closed: rows.filter((t) => isClosed(t.status)),
      };

      // Si llega algún status raro, lo dejamos como "open" para no perderlo
      const leftovers = rows.filter(
        (t) => !isOpen(t.status) && !isInProgress(t.status) && !isClosed(t.status)
      );
      if (leftovers.length) grouped.open = [...leftovers, ...grouped.open];

      setTicketsByStatus(grouped);
    } catch (e) {
      console.error("Error cargando tickets:", e);
      setTickets([]);
      setTicketsByStatus({ open: [], in_progress: [], closed: [] });
    } finally {
      setLoadingTickets(false);
    }
  }

  async function handleDeleteEvent(eventId) {
    if (!confirm("¿Seguro que quieres eliminar este evento?")) return;
    try {
      const { error } = await supabase.from("events").delete().eq("id", eventId);
      if (error) throw error;
      await loadEvents();
    } catch (e) {
      console.error("Error eliminando evento:", e);
      alert("No se pudo eliminar el evento.");
    }
  }

  function handleGoToUsers() {
    router.push("/admin/users");
  }

  function formatDate(iso) {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleString("es-CL", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return String(iso);
    }
  }

  function formatEventDate(iso) {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleDateString("es-CL", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });
    } catch {
      return String(iso);
    }
  }

  if (checkingAdmin) {
    return (
      <main className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-6xl px-4 py-10">
          <p className="text-sm text-gray-500">Validando permisos admin...</p>
        </div>
      </main>
    );
  }

  if (!isAdmin) return null;

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-6xl px-4 py-10 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Panel Admin</h1>
            <p className="text-sm text-gray-500">
              Gestión de usuarios, eventos y soporte.
            </p>
          </div>

          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            ← Volver a mi cuenta
          </button>
        </div>

        {/* CARDS PRINCIPALES */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* CARD USUARIOS */}
          <div
            onClick={handleGoToUsers}
            className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 cursor-pointer hover:shadow-md transition-shadow"
          >
            <h3 className="text-lg font-semibold text-gray-900">Usuarios</h3>
            <p className="text-sm text-gray-500 mt-1">Editar roles, bloquear cuentas</p>
            <button className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
              Ir a Usuarios →
            </button>
          </div>

          {/* CARD EVENTOS */}
          <div
            onClick={() => router.push("/admin/events")}
            className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 cursor-pointer hover:shadow-md transition-shadow"
          >
            <h3 className="text-lg font-semibold text-gray-900">Eventos</h3>
            <p className="text-sm text-gray-500 mt-1">Crear y gestionar eventos</p>
            <button className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
              Ir a Eventos →
            </button>
          </div>

          {/* CARD SOLICITUDES EVENTO */}
          <div
            onClick={() => router.push("/admin/event-requests")}
            className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 cursor-pointer hover:shadow-md transition-shadow"
          >
            <h3 className="text-lg font-semibold text-gray-900">Solicitudes de evento</h3>
            <p className="text-sm text-gray-500 mt-1">Aprobar y publicar automáticamente</p>
            <button className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
              Ir a Solicitudes →
            </button>
          </div>

          {/* CARD SOPORTE */}
          <div
            onClick={() => router.push("/admin/support")}
            className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 cursor-pointer hover:shadow-md transition-shadow"
          >
            <h3 className="text-lg font-semibold text-gray-900">Soporte</h3>
            <p className="text-sm text-gray-500 mt-1">Gestionar tickets de soporte</p>
            <button className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
              Ir a Tickets →
            </button>
          </div>
        </div>

        {/* SECCIÓN EVENTOS */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Eventos</h2>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => router.push("/admin/events")}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              >
                Crear evento
              </button>
            </div>
          </div>

          {loadingEvents ? (
            <p className="text-sm text-gray-500">Cargando eventos...</p>
          ) : events.length === 0 ? (
            <p className="text-sm text-gray-500">No hay eventos creados todavía.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b border-gray-100">
                    <th className="py-2 pr-4">Evento</th>
                    <th className="py-2 pr-4">Fecha</th>
                    <th className="py-2 pr-4">Lugar</th>
                    <th className="py-2 pr-4">Ciudad</th>
                    <th className="py-2 pr-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((ev) => (
                    <tr key={ev.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-2 pr-4 text-gray-900">{ev.title}</td>
                      <td className="py-2 pr-4 text-gray-700">
                        {formatEventDate(ev.starts_at)}
                      </td>
                      <td className="py-2 pr-4 text-gray-700">{ev.venue || "—"}</td>
                      <td className="py-2 pr-4 text-gray-700">{ev.city || "—"}</td>
                      <td className="py-2 pr-0 text-right">
                        <button
                          type="button"
                          onClick={() => handleDeleteEvent(ev.id)}
                          className="text-xs text-red-600 hover:text-red-700"
                        >
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* SECCIÓN TICKETS */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Tickets</h2>
          </div>

          {loadingTickets ? (
            <p className="text-sm text-gray-500">Cargando tickets...</p>
          ) : tickets.length === 0 ? (
            <p className="text-sm text-gray-500">Aún no hay tickets de soporte.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <h3 className="font-semibold text-gray-800 mb-2">
                  Abiertos ({ticketsByStatus.open.length})
                </h3>
                <div className="space-y-2">
                  {ticketsByStatus.open.map((t) => (
                    <TicketCard key={t.id} ticket={t} formatDate={formatDate} />
                  ))}
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-gray-800 mb-2">
                  En proceso ({ticketsByStatus.in_progress.length})
                </h3>
                <div className="space-y-2">
                  {ticketsByStatus.in_progress.map((t) => (
                    <TicketCard key={t.id} ticket={t} formatDate={formatDate} />
                  ))}
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-gray-800 mb-2">
                  Cerrados ({ticketsByStatus.closed.length})
                </h3>
                <div className="space-y-2">
                  {ticketsByStatus.closed.map((t) => (
                    <TicketCard key={t.id} ticket={t} formatDate={formatDate} />
                  ))}
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function TicketCard({ ticket, formatDate }) {
  return (
    <div className="border border-gray-100 rounded-xl p-3 bg-gray-50">
      <p className="text-xs text-gray-500 mb-1">
        {ticket.requester_email || "Usuario sin email"}
      </p>
      <p className="text-gray-900 font-medium line-clamp-2">{ticket.subject}</p>
      <p className="text-xs text-gray-500 mt-1">
        Creado: {formatDate(ticket.created_at)}
      </p>
    </div>
  );
}
