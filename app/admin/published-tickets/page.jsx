"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import supabase from "@/lib/supabaseClient";

function formatDate(value) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString("es-CL", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(value);
  }
}

function formatPrice(value, currency = "CLP") {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "—";
  if (String(currency || "").toUpperCase() === "CLP") {
    return `$${amount.toLocaleString("es-CL")}`;
  }
  return `${amount.toLocaleString("es-CL")} ${currency}`;
}

export default function AdminPublishedTicketsPage() {
  const router = useRouter();
  const [checkingAdmin, setCheckingAdmin] = useState(true);
  const [authToken, setAuthToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState({
    total_active: 0,
    events: 0,
    sellers: 0,
  });
  const [query, setQuery] = useState("");
  const [eventFilter, setEventFilter] = useState("");

  useEffect(() => {
    let mounted = true;

    async function boot() {
      try {
        setCheckingAdmin(true);

        const { data: sessionData } = await supabase.auth.getSession();
        const session = sessionData?.session;
        if (!session?.user) {
          router.push("/login");
          return;
        }

        const { data: userData } = await supabase.auth.getUser();
        const user = userData?.user;
        if (!user) {
          router.push("/login");
          return;
        }

        const { data: profile } = await supabase
          .from("profiles")
          .select("user_type, app_role, email")
          .eq("id", user.id)
          .maybeSingle();

        const email = String(profile?.email || user.email || "").toLowerCase().trim();
        const isAdmin =
          String(profile?.user_type || "").toLowerCase() === "admin" ||
          String(profile?.app_role || "").toLowerCase() === "admin" ||
          email === "soporte@tixswap.cl";

        if (!isAdmin) {
          router.push("/dashboard");
          return;
        }

        if (!mounted) return;
        setAuthToken(session.access_token || "");
      } catch (bootError) {
        console.error("[admin/published-tickets] boot error:", bootError);
        router.push("/dashboard");
      } finally {
        if (mounted) setCheckingAdmin(false);
      }
    }

    boot();
    return () => {
      mounted = false;
    };
  }, [router]);

  useEffect(() => {
    if (!authToken) return;
    let alive = true;

    async function loadRows() {
      try {
        setLoading(true);
        setError("");

        const url = new URL("/api/admin/published-tickets", window.location.origin);
        url.searchParams.set("limit", "500");

        const res = await fetch(url.toString(), {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        });

        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(json?.error || "No se pudieron cargar las entradas publicadas");
        }

        if (!alive) return;
        setRows(json?.tickets || []);
        setSummary(
          json?.summary || {
            total_active: 0,
            events: 0,
            sellers: 0,
          }
        );
      } catch (loadError) {
        if (!alive) return;
        console.error("[admin/published-tickets] load error:", loadError);
        setRows([]);
        setSummary({ total_active: 0, events: 0, sellers: 0 });
        setError(loadError?.message || "No se pudieron cargar las entradas publicadas");
      } finally {
        if (alive) setLoading(false);
      }
    }

    loadRows();
    return () => {
      alive = false;
    };
  }, [authToken]);

  const eventOptions = useMemo(() => {
    return Array.from(
      new Map(
        rows
          .filter((row) => row.event_id && row.event?.title)
          .map((row) => [row.event_id, { id: row.event_id, title: row.event.title }])
      ).values()
    ).sort((a, b) => a.title.localeCompare(b.title, "es"));
  }, [rows]);

  const filteredRows = useMemo(() => {
    const search = query.trim().toLowerCase();

    return rows.filter((row) => {
      if (eventFilter && row.event_id !== eventFilter) return false;
      if (!search) return true;

      const haystack = [
        row.event?.title,
        row.event?.venue,
        row.seller?.name,
        row.seller?.email,
        row.ticket_type,
        row.sale_type_label,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(search);
    });
  }, [rows, query, eventFilter]);

  if (checkingAdmin) {
    return (
      <main className="min-h-[100dvh] bg-slate-50">
        <div className="mx-auto max-w-7xl px-4 py-10">
          <p className="text-sm text-slate-500">Validando permisos admin...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[100dvh] overflow-x-hidden bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:py-8 lg:py-10">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Entradas publicadas</h1>
            <p className="text-sm text-slate-500">
              Vista admin de todas las entradas activas publicadas en TixSwap.
            </p>
          </div>

          <button
            type="button"
            onClick={() => router.push("/admin")}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 hover:text-slate-900 sm:w-auto"
          >
            ← Volver al admin
          </button>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Activas
            </div>
            <div className="mt-2 text-2xl font-bold text-slate-900">{summary.total_active || 0}</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Eventos
            </div>
            <div className="mt-2 text-2xl font-bold text-slate-900">{summary.events || 0}</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Vendedores
            </div>
            <div className="mt-2 text-2xl font-bold text-slate-900">{summary.sellers || 0}</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Mostrando
            </div>
            <div className="mt-2 text-2xl font-bold text-slate-900">{filteredRows.length}</div>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <input
              className="tix-input w-full"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por evento, vendedor o tipo de entrada"
            />
            <select
              className="tix-input w-full"
              value={eventFilter}
              onChange={(e) => setEventFilter(e.target.value)}
            >
              <option value="">Todos los eventos</option>
              {eventOptions.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.title}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setEventFilter("");
              }}
              className="tix-btn-secondary w-full"
            >
              Limpiar filtros
            </button>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-slate-200 bg-white shadow-sm">
          {loading ? (
            <div className="p-6 text-sm text-slate-500">Cargando entradas activas...</div>
          ) : error ? (
            <div className="p-6 text-sm text-red-600">{error}</div>
          ) : filteredRows.length === 0 ? (
            <div className="p-6 text-sm text-slate-500">No hay entradas activas para esos filtros.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-slate-500">
                    <th className="px-4 py-3">Evento</th>
                    <th className="px-4 py-3">Entrada</th>
                    <th className="px-4 py-3">Usuario</th>
                    <th className="px-4 py-3">Precio</th>
                    <th className="px-4 py-3">Publicada</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row) => (
                    <tr key={row.id} className="border-b border-slate-50 align-top">
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">
                          {row.event?.title || "Evento"}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          {[row.event?.venue, row.event?.city].filter(Boolean).join(" · ") || "—"}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">{row.ticket_type || "Entrada"}</div>
                        <div className="mt-1 text-xs text-slate-500">{row.sale_type_label || "—"}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">{row.seller?.name || "Vendedor"}</div>
                        <div className="mt-1 break-all text-xs text-slate-500">
                          {row.seller?.email || row.seller?.id || "—"}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {formatPrice(row.price, row.currency)}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{formatDate(row.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
