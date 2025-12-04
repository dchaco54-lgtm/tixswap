// app/dashboard/tickets/page.jsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../lib/supabaseClient";

export default function TicketsPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);

  const [tickets, setTickets] = useState([]);
  const [loadingTickets, setLoadingTickets] = useState(true);

  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");

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
      setLoadingUser(false);
    };

    load();
  }, [router]);

  const goHome = () => router.push("/");
  const goDashboard = () => router.push("/dashboard");

  const filteredTickets = tickets.filter((t) => {
    if (statusFilter !== "all" && t.status !== statusFilter) return false;

    if (categoryFilter !== "all") {
      if (categoryFilter === "disputas") {
        return (
          t.category === "disputa" ||
          t.category === "disputa_compra" ||
          t.category === "disputa_venta"
        );
      }
      if (categoryFilter === "sugerencias") {
        return t.category === "sugerencia";
      }
      if (categoryFilter === "reclamos") {
        return t.category === "reclamo";
      }
      if (categoryFilter === "soporte") {
        return t.category === "soporte";
      }
      if (categoryFilter === "otros") {
        return (
          t.category !== "soporte" &&
          t.category !== "disputa" &&
          t.category !== "disputa_compra" &&
          t.category !== "disputa_venta" &&
          t.category !== "sugerencia" &&
          t.category !== "reclamo"
        );
      }
    }

    return true;
  });

  if (loadingUser) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-sm text-slate-500">Cargando tu cuenta…</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-5xl mx-auto px-4 py-10 md:py-12">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold text-slate-900">
              Mis tickets de soporte
            </h1>
            <p className="text-sm text-slate-500">
              Revisa el historial completo de tus solicitudes a TixSwap.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={goDashboard}
              className="text-sm px-4 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50"
            >
              Volver al panel
            </button>
            <button
              onClick={goHome}
              className="text-sm px-4 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50"
            >
              Comprar / vender entradas
            </button>
          </div>
        </div>

        {/* Filtros */}
        <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm mb-6">
          <div className="flex flex-col md:flex-row gap-4 md:items-center md:justify-between">
            <div className="flex flex-wrap gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Estado
                </label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">Todos</option>
                  <option value="open">Abierto</option>
                  <option value="in_progress">En revisión</option>
                  <option value="closed">Cerrado</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Tipo de ticket
                </label>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">Todos</option>
                  <option value="soporte">Soporte general</option>
                  <option value="disputas">Disputas compra/venta</option>
                  <option value="sugerencias">Sugerencias TixSwap</option>
                  <option value="reclamos">Reclamos TixSwap</option>
                  <option value="otros">Otros</option>
                </select>
              </div>
            </div>

            <p className="text-xs text-slate-400">
              {filteredTickets.length} ticket
              {filteredTickets.length === 1 ? "" : "s"} encontrados.
            </p>
          </div>
        </div>

        {/* Lista completa */}
        <div className="bg-white border border-slate-100 rounded-2xl p-4 md:p-6 shadow-sm">
          {loadingTickets ? (
            <p className="text-sm text-slate-500">
              Cargando tus tickets de soporte…
            </p>
          ) : filteredTickets.length === 0 ? (
            <p className="text-sm text-slate-500">
              No encontramos tickets con los filtros seleccionados.
            </p>
          ) : (
            <ul className="space-y-3">
              {filteredTickets.map((t) => (
                <li
                  key={t.id}
                  className="border border-slate-200 rounded-xl px-3 py-3 text-sm"
                >
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 mb-1.5">
                    <div>
                      <p className="font-medium text-slate-900">
                        {t.subject}
                      </p>
                      <p className="text-xs text-slate-500">
                        {formatCategory(t.category)} ·{" "}
                        {new Date(t.created_at).toLocaleString("es-CL", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </p>
                    </div>
                    <StatusPill status={t.status} />
                  </div>

                  <div className="space-y-1.5">
                    <div>
                      <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                        Tu mensaje
                      </p>
                      <p className="text-xs text-slate-700 whitespace-pre-line">
                        {t.message}
                      </p>
                    </div>

                    {t.admin_response && (
                      <div className="mt-2 rounded-lg bg-slate-50 border border-slate-100 px-3 py-2">
                        <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                          Respuesta de TixSwap
                        </p>
                        <p className="text-xs text-slate-800 whitespace-pre-line">
                          {t.admin_response}
                        </p>
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-6 text-xs text-slate-400">
          ¿No encuentras algo? Puedes escribirnos a{" "}
          <Link
            href="mailto:soporte@tixswap.cl"
            className="text-blue-600 hover:underline"
          >
            soporte@tixswap.cl
          </Link>
          .
        </div>
      </div>
    </main>
  );
}

// --- helpers reutilizados ----

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
  if (category === "disputa_compra") return "Disputa por compra";
  if (category === "disputa_venta") return "Disputa por venta";
  if (category === "sugerencia") return "Sugerencia para TixSwap";
  if (category === "reclamo") return "Reclamo para TixSwap";
  if (category === "disputa") return "Disputa";
  if (category === "otro") return "Otro";
  return category || "—";
}
