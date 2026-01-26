"use client";

import { useEffect, useState } from "react";

function getAccessTokenSafe() {
  if (typeof window === "undefined") return null;

  // 1) más típico en proyectos custom
  const t1 = window.localStorage.getItem("access_token");
  if (t1) return t1;

  // 2) algunas apps guardan esto (depende de implementación)
  const t2 = window.localStorage.getItem("sb-access-token");
  if (t2) return t2;

  // 3) legacy / inventos
  const t3 = window.localStorage.getItem("supabase.auth.token");
  if (t3) return t3;

  return null;
}

export default function MisPublicaciones() {
  const [tickets, setTickets] = useState([]);
  const [summary, setSummary] = useState({
    total: 0,
    active: 0,
    paused: 0,
    sold: 0,
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchPublications = async () => {
    try {
      setLoading(true);
      setError(null);

      const token = getAccessTokenSafe();
      if (!token) {
        setTickets([]);
        setSummary({ total: 0, active: 0, paused: 0, sold: 0 });
        setError(
          "No encontré tu sesión (token). Cierra sesión y vuelve a entrar."
        );
        return;
      }

      const res = await fetch(`/api/tickets/my-publications?ts=${Date.now()}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || "Error cargando publicaciones");
      }

      const data = await res.json();
      setTickets(data.tickets || []);
      setSummary(
        data.summary || { total: 0, active: 0, paused: 0, sold: 0 }
      );
    } catch (err) {
      console.error("Error loading publications:", err);
      setError("No se pudieron cargar tus publicaciones.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPublications();
  }, []);

  if (loading) {
    return (
      <div className="p-6 text-center text-gray-500">
        Cargando publicaciones...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-center text-red-500">
        {error}
        <div className="mt-3 flex items-center justify-center gap-2">
          <button
            onClick={fetchPublications}
            className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
          >
            Reintentar
          </button>
          <a
            href="/logout"
            className="px-4 py-2 rounded border hover:bg-gray-50 text-gray-700"
          >
            Cerrar sesión
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Mis publicaciones</h1>

        <button
          onClick={fetchPublications}
          className="px-3 py-2 text-sm rounded border hover:bg-gray-50"
        >
          Recargar
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <SummaryCard label="Total" value={summary.total} />
        <SummaryCard label="Activas" value={summary.active} />
        <SummaryCard label="Pausadas" value={summary.paused} />
        <SummaryCard label="Vendidas" value={summary.sold} />
      </div>

      {/* Tabla */}
      {tickets.length === 0 ? (
        <div className="text-gray-500">No tienes publicaciones aún.</div>
      ) : (
        <div className="overflow-x-auto border rounded">
          <table className="w-full text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-3 text-left">Evento</th>
                <th className="p-3 text-left">Ubicación</th>
                <th className="p-3 text-left">Asiento</th>
                <th className="p-3 text-left">Precio</th>
                <th className="p-3 text-left">Estado</th>
              </tr>
            </thead>

            <tbody>
              {tickets.map((t) => (
                <tr key={t.id} className="border-t">
                  <td className="p-3">
                    <div className="font-medium">{t.event?.title || "-"}</div>
                    <div className="text-xs text-gray-500">
                      {t.event?.venue || "-"} — {t.event?.city || "-"}
                    </div>
                  </td>

                  <td className="p-3">
                    {t.section || "-"} / Fila {t.row || "-"} / Asiento{" "}
                    {t.seat || "-"}
                  </td>

                  <td className="p-3">
                    {(t.section || "-") + "-" + (t.row || "-") + "-" + (t.seat || "-")}
                  </td>

                  <td className="p-3 font-semibold">
                    ${Number(t.price || 0).toLocaleString("es-CL")}
                  </td>

                  <td className="p-3">
                    <StatusBadge status={t.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ===================== */
/* ====== UI bits ====== */
/* ===================== */

function SummaryCard({ label, value }) {
  return (
    <div className="border rounded p-4">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-xl font-semibold">{value}</div>
    </div>
  );
}

function StatusBadge({ status }) {
  const map = {
    active: { label: "Activa", className: "bg-green-100 text-green-700" },
    paused: { label: "Pausada", className: "bg-yellow-100 text-yellow-700" },
    sold: { label: "Vendida", className: "bg-gray-200 text-gray-700" },
  };

  const cfg = map[status] || {
    label: status || "-",
    className: "bg-gray-100 text-gray-600",
  };

  return (
    <span
      className={`inline-block px-2 py-1 rounded text-xs font-medium ${cfg.className}`}
    >
      {cfg.label}
    </span>
  );
}

