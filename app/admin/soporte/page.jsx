// app/admin/soporte/page.jsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

const STATUS_OPTIONS = [
  { value: "open", label: "Abierto" },
  { value: "in_progress", label: "En revisión" },
  { value: "closed", label: "Cerrado" },
];

export default function AdminSupportPage() {
  const router = useRouter();
  const [loadingUser, setLoadingUser] = useState(true);
  const [tickets, setTickets] = useState([]);
  const [loadingTickets, setLoadingTickets] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const init = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      setLoadingUser(false);
      await fetchTickets();
    };

    init();
  }, [router]);

  const fetchTickets = async () => {
    setLoadingTickets(true);
    setError("");

    const { data, error } = await supabase
      .from("support_tickets")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      setError("No pudimos cargar los tickets. Intenta de nuevo.");
      setTickets([]);
    } else {
      setTickets(data || []);
    }

    setLoadingTickets(false);
  };

  const handleFieldChange = (id, field, value) => {
    setTickets((prev) =>
      prev.map((t) =>
        t.id === id
          ? {
              ...t,
              [field]: value,
            }
          : t
      )
    );
  };

  const handleSaveTicket = async (ticket) => {
    setSavingId(ticket.id);
    setError("");

    const { error } = await supabase
      .from("support_tickets")
      .update({
        status: ticket.status,
        admin_response: ticket.admin_response || null,
      })
      .eq("id", ticket.id);

    if (error) {
      console.error(error);
      setError("No pudimos actualizar el ticket. Intenta nuevamente.");
    }

    setSavingId(null);
  };

  if (loadingUser) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-sm text-slate-500">Cargando…</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto px-4 py-8 md:py-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold text-slate-900">
              Soporte · Admin
            </h1>
            <p className="text-sm text-slate-500">
              Revisa y responde los tickets creados por los usuarios.
            </p>
          </div>

          <button
            onClick={() => router.push("/")}
            className="text-sm px-4 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50"
          >
            Volver al inicio
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 md:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-900">
              Tickets de soporte
            </h2>
            {loadingTickets ? (
              <span className="text-xs text-slate-400">Cargando…</span>
            ) : (
              <span className="text-xs text-slate-400">
                {tickets.length} ticket
                {tickets.length === 1 ? "" : "s"}
              </span>
            )}
          </div>

          {loadingTickets ? (
            <p className="text-sm text-slate-500">
              Cargando tickets de soporte…
            </p>
          ) : tickets.length === 0 ? (
            <p className="text-sm text-slate-500">
              Aún no hay tickets creados por los usuarios.
            </p>
          ) : (
            <div className="space-y-4">
              {tickets.map((t) => (
                <div
                  key={t.id}
                  className="border border-slate-200 rounded-xl p-4 text-sm bg-slate-50/60"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <div>
                      <p className="font-semibold text-slate-900">
                        {t.subject}
                      </p>
                      <p className="text-xs text-slate-500">
                        {formatCategory(t.category)} ·{" "}
                        {new Date(t.created_at).toLocaleString("es-CL", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </p>
                      <p className="text-xs text-slate-500">
                        Usuario ID:{" "}
                        <span className="font-mono">{t.user_id}</span>
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <label className="text-xs text-slate-500">
                        Estado:
                      </label>
                      <select
                        value={t.status}
                        onChange={(e) =>
                          handleFieldChange(t.id, "status", e.target.value)
                        }
                        className="border border-slate-300 rounded-lg px-2 py-1 text-xs bg-white"
                      >
                        {STATUS_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="mb-3">
                    <p className="text-xs font-semibold text-slate-700 mb-1">
                      Mensaje del usuario
                    </p>
                    <p className="text-xs text-slate-700 whitespace-pre-line">
                      {t.message}
                    </p>
                  </div>

                  <div className="mb-3">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Respuesta de soporte
                    </label>
                    <textarea
                      className="w-full border border-slate-300 rounded-lg px-2 py-1 text-xs min-h-[80px] focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Escribe aquí la respuesta que verá el usuario en su panel."
                      value={t.admin_response || ""}
                      onChange={(e) =>
                        handleFieldChange(
                          t.id,
                          "admin_response",
                          e.target.value
                        )
                      }
                    />
                  </div>

                  <div className="flex justify-end">
                    <button
                      onClick={() => handleSaveTicket(t)}
                      disabled={savingId === t.id}
                      className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60"
                    >
                      {savingId === t.id ? "Guardando…" : "Guardar cambios"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function formatCategory(category) {
  if (category === "soporte") return "Soporte general";
  if (category === "disputa") return "Disputa";
  if (category === "otro") return "Otro";
  return category || "—";
}
