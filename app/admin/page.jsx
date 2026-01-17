"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabaseClient";

export default function AdminPage() {
  const router = useRouter();

  const [checkingAdmin, setCheckingAdmin] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const [events, setEvents] = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(true);

  const [tickets, setTickets] = useState([]);
  const [loadingTickets, setLoadingTickets] = useState(true);

  // SOLO soporte@tixswap.cl entra acá
  useEffect(() => {
    const init = async () => {
      if (!supabase) {
        router.replace("/login");
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      // Validar que el usuario sea admin en la BD
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (profileError || profile?.role !== "admin") {
        router.replace("/dashboard");
        return;
      }

      setIsAdmin(true);
      setCheckingAdmin(false);

      // Cargar eventos
      try {
        const { data, error } = await supabase
          .from("events")
          .select("id, title, starts_at, venue, city")
          .order("starts_at", { ascending: true });

        if (error) {
          console.error("Error cargando eventos:", error);
        } else {
          setEvents(data || []);
        }
      } finally {
        setLoadingEvents(false);
      }

      // Cargar tickets de soporte
      try {
        const { data, error } = await supabase
          .from("support_tickets")
          .select("id, email, subject, status, created_at")
          .order("created_at", { ascending: false });

        if (error) {
          console.error("Error cargando tickets:", error);
        } else {
          setTickets(data || []);
        }
      } finally {
        setLoadingTickets(false);
      }
    };

    init();
  }, [router]);

  // Redirigir a usuarios
  const handleGoToUsers = () => {
    router.push("/admin/users");
  };

  const handleDeleteEvent = async (id) => {
    if (!confirm("¿Seguro que quieres eliminar este evento?")) return;

    const { error } = await supabase.from("events").delete().eq("id", id);
    if (error) {
      console.error(error);
      alert("No se pudo eliminar el evento.");
      return;
    }

    setEvents((prev) => prev.filter((e) => e.id !== id));
  };

  if (checkingAdmin) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="rounded-2xl bg-white px-6 py-4 shadow-sm border border-gray-100 text-sm text-gray-700">
          Validando permisos de administrador...
        </div>
      </main>
    );
  }

  if (!isAdmin) {
    return null;
  }

  // Agrupar tickets por estado
  const ticketsByStatus = {
    open: [],
    in_progress: [],
    closed: [],
  };

  for (const t of tickets) {
    if (t.status === "in_progress") ticketsByStatus.in_progress.push(t);
    else if (t.status === "closed") ticketsByStatus.closed.push(t);
    else ticketsByStatus.open.push(t);
  }

  const formatDate = (iso) => {
    const d = new Date(iso);
    const dia = d.getDate().toString().padStart(2, "0");
    const mes = d.toLocaleString("es-CL", { month: "short" });
    const año = d.getFullYear();
    const hora = d.toLocaleTimeString("es-CL", {
      hour: "2-digit",
      minute: "2-digit",
    });
    return `${dia} ${mes} ${año}, ${hora}`;
  };

  const formatEventDate = (iso) => {
    const d = new Date(iso);
    const dia = d.getDate().toString().padStart(2, "0");
    const mes = d.toLocaleString("es-CL", { month: "short" });
    const año = d.getFullYear();
    return `${dia} ${mes} ${año}`;
  };

  return (
    <main className="min-h-screen bg-gray-50 py-10">
      <div className="max-w-6xl mx-auto px-4 space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-gray-900">
            Panel administrador TixSwap
          </h1>
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

          {/* CARD TICKETS */}
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
            <p className="text-sm text-gray-500">
              No hay eventos creados todavía.
            </p>
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
                    <tr
                      key={ev.id}
                      className="border-b border-gray-50 hover:bg-gray-50"
                    >
                      <td className="py-2 pr-4 text-gray-900">{ev.title}</td>
                      <td className="py-2 pr-4 text-gray-700">
                        {formatEventDate(ev.starts_at)}
                      </td>
                      <td className="py-2 pr-4 text-gray-700">
                        {ev.venue || "—"}
                      </td>
                      <td className="py-2 pr-4 text-gray-700">
                        {ev.city || "—"}
                      </td>
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
            <p className="text-sm text-gray-500">
              Aún no hay tickets de soporte.
            </p>
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
        {ticket.email || "Usuario sin email"}
      </p>
      <p className="text-gray-900 font-medium line-clamp-2">{ticket.subject}</p>
      <p className="text-xs text-gray-500 mt-1">
        Creado: {formatDate(ticket.created_at)}
      </p>
    </div>
  );
}
