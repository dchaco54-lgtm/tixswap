"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
// 👇 usa el mismo import que en login/register, solo cambiando el camino
import supabase from "../../../lib/supabaseClient"; // si falla, prueba con "../../../lib/supabaseClient"

export default function SupportAdminPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [tickets, setTickets] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [response, setResponse] = useState("");
  const [status, setStatus] = useState("open");
  const [error, setError] = useState("");

  useEffect(() => {
    const init = async () => {
      // 1. Verificamos que sea el admin de soporte
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user || user.email !== "soporte@tixswap.cl") {
        router.push("/");
        return;
      }

      // 2. Traemos todos los tickets
      const { data, error } = await supabase
        .from("support_tickets")
        .select(
          "id, category, subject, message, status, created_at, admin_response"
        )
        .order("created_at", { ascending: false });

      if (error) {
        console.error(error);
        setError("No pudimos cargar los tickets.");
      } else {
        setTickets(data || []);
      }

      setLoading(false);
    };

    init();
  }, [router]);

  const handleSelectTicket = (ticket) => {
    setSelectedTicket(ticket);
    setResponse(ticket.admin_response || "");
    setStatus(ticket.status);
    setError("");
  };

  const handleUpdate = async () => {
    if (!selectedTicket) return;

    const { error } = await supabase
      .from("support_tickets")
      .update({
        status,
        admin_response: response || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", selectedTicket.id);

    if (error) {
      console.error(error);
      setError("No pudimos actualizar el ticket.");
      return;
    }

    // Refrescamos estado local
    const updatedTickets = tickets.map((t) =>
      t.id === selectedTicket.id
        ? { ...t, status, admin_response: response }
        : t
    );
    setTickets(updatedTickets);
    setSelectedTicket((t) =>
      t ? { ...t, status, admin_response: response } : t
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        Cargando panel de soporte...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-semibold">Panel de soporte TixSwap</h1>
          <p className="text-xs text-gray-500">
            Sesión admin:&nbsp;
            <span className="font-medium">soporte@tixswap.cl</span>
          </p>
        </div>

        <div className="grid md:grid-cols-[2fr,3fr] gap-6">
          {/* Lista de tickets */}
          <div className="bg-white rounded-2xl shadow p-4">
            <h2 className="font-medium mb-4">Tickets recibidos</h2>
            <div className="space-y-3 max-h-[600px] overflow-y-auto">
              {tickets.length === 0 && (
                <p className="text-sm text-gray-500">
                  Aún no hay tickets de soporte.
                </p>
              )}

              {tickets.map((ticket) => (
                <button
                  key={ticket.id}
                  onClick={() => handleSelectTicket(ticket)}
                  className={`w-full text-left border rounded-xl px-3 py-2 text-sm hover:border-blue-500 transition ${
                    selectedTicket?.id === ticket.id
                      ? "border-blue-500 bg-blue-50"
                      : "border-slate-200 bg-white"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium">{ticket.subject}</span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        ticket.status === "open"
                          ? "bg-orange-100 text-orange-700"
                          : ticket.status === "in_progress"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-emerald-100 text-emerald-700"
                      }`}
                    >
                      {ticket.status === "open"
                        ? "Abierto"
                        : ticket.status === "in_progress"
                        ? "En proceso"
                        : "Cerrado"}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">
                    {ticket.category} ·{" "}
                    {new Date(ticket.created_at).toLocaleString("es-CL")}
                  </p>
                  {ticket.admin_response && (
                    <p className="mt-1 text-[11px] text-gray-500 line-clamp-1">
                      <span className="font-semibold">Respuesta: </span>
                      {ticket.admin_response}
                    </p>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Detalle del ticket */}
          <div className="bg-white rounded-2xl shadow p-4">
            {selectedTicket ? (
              <>
                <h2 className="font-medium mb-3">Detalle del ticket</h2>

                <div className="mb-3">
                  <p className="text-sm">
                    <span className="font-semibold">Asunto: </span>
                    {selectedTicket.subject}
                  </p>
                  <p className="text-sm text-gray-600 mt-1">
                    <span className="font-semibold">Categoría: </span>
                    {selectedTicket.category}
                  </p>
                  <p className="text-sm text-gray-600 mt-2">
                    <span className="font-semibold">Mensaje del usuario:</span>
                    <br />
                    {selectedTicket.message}
                  </p>
                </div>

                <div className="mb-3">
                  <label className="block text-sm font-medium mb-1">
                    Estado
                  </label>
                  <select
                    className="border rounded-lg px-3 py-2 text-sm w-full"
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                  >
                    <option value="open">Abierto</option>
                    <option value="in_progress">En proceso</option>
                    <option value="closed">Cerrado</option>
                  </select>
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium mb-1">
                    Respuesta para el usuario
                  </label>
                  <textarea
                    className="w-full border rounded-lg px-3 py-2 text-sm min-h-[120px]"
                    placeholder="Escribe aquí la respuesta que verá el usuario en su panel."
                    value={response}
                    onChange={(e) => setResponse(e.target.value)}
                  />
                </div>

                {error && (
                  <p className="text-sm text-red-500 mb-3">{error}</p>
                )}

                <button
                  onClick={handleUpdate}
                  className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
                >
                  Guardar cambios
                </button>
              </>
            ) : (
              <p className="text-sm text-gray-500">
                Selecciona un ticket en la lista de la izquierda para verlo y
                responderlo.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
