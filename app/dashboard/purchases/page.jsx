"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/** =========================
 *  Auth token helper (igual a MisPublicaciones)
 *  ========================= */
async function getAccessToken() {
  // 1) cookies + auth helpers (si existe en tu proyecto)
  try {
    const supabase = createClient();
    const { data, error } = await supabase.auth.getSession();
    if (!error && data?.session?.access_token) {
      return data.session.access_token;
    }
  } catch (e) {
    // seguimos con fallback
  }

  // 2) fallback localStorage (legacy)
  if (typeof window !== "undefined") {
    try {
      const raw = window.localStorage.getItem("sb-auth-token");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.access_token) return parsed.access_token;
      }
    } catch (e) {}
  }

  return null;
}

/** =========================
 *  Page: Mis compras
 *  ========================= */
export default function PurchasesPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      setError(null);

      const token = await getAccessToken();
      if (!token) {
        setOrders([]);
        setError("No hay sesión válida. Cierra sesión y vuelve a entrar.");
        return;
      }

      const res = await fetch(`/api/orders/my?ts=${Date.now()}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`, // ✅ ESTE ES EL PUNTO
        },
        cache: "no-store",
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`API ${res.status} ${res.statusText} - ${txt || "sin detalle"}`);
      }

      const data = await res.json();
      setOrders(Array.isArray(data?.orders) ? data.orders : []);
    } catch (err) {
      console.error("PurchasesPage error:", err);
      setError(typeof err?.message === "string" ? err.message : "No se pudieron cargar tus compras.");
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  if (loading) {
    return <div className="p-6 text-center text-gray-500">Cargando compras...</div>;
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="max-w-4xl mx-auto border border-red-200 bg-red-50 text-red-700 rounded p-4">
          <div className="font-semibold mb-1">No se pudieron cargar tus compras.</div>
          <div className="text-xs text-red-600 break-words">{error}</div>

          <div className="mt-4 flex items-center gap-2">
            <button
              onClick={fetchOrders}
              className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
            >
              Reintentar
            </button>
            <a
              href="/logout"
              className="px-4 py-2 rounded border hover:bg-white text-gray-700"
            >
              Cerrar sesión
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Mis compras</h1>

        <button
          onClick={fetchOrders}
          className="px-3 py-2 text-sm rounded border hover:bg-gray-50"
        >
          Refrescar
        </button>
      </div>

      {/* Empty */}
      {orders.length === 0 ? (
        <div className="max-w-4xl mx-auto border rounded bg-white p-6 text-gray-600">
          Aún no tienes compras.
        </div>
      ) : (
        <div className="max-w-4xl mx-auto space-y-4">
          {orders.map((o) => (
            <OrderCard key={o.id} order={o} />
          ))}
        </div>
      )}
    </div>
  );
}

/** =========================
 *  UI bits
 *  ========================= */

function OrderCard({ order }) {
  const ticket = order?.ticket ?? null;

  // En tu JSON venía order.event (normalizado), pero por si acaso:
  const event = order?.event ?? ticket?.event ?? null;

  const title = event?.title || "Evento";
  const venue = event?.venue || "-";
  const city = event?.city || "-";

  const startsAt = event?.starts_at ? new Date(event.starts_at) : null;
  const startsLabel = startsAt ? formatDateCL(startsAt) : "";

  const sector = ticket?.sector || ticket?.section_label || "-";
  const row = ticket?.row_label || "-";
  const seat = ticket?.seat_label || "-";

  const amount =
    toNumber(order?.total_clp) ??
    (toNumber(order?.amount_clp) ?? 0) + (toNumber(order?.fee_clp) ?? 0);

  const status = String(order?.status || "").toLowerCase();
  const paidAt = order?.paid_at ? new Date(order.paid_at) : null;
  const createdAt = order?.created_at ? new Date(order.created_at) : null;

  const statusDate = paidAt || createdAt;
  const statusDateLabel = statusDate ? formatDateCL(statusDate) : "";

  return (
    <div className="border rounded-xl bg-white p-6 flex items-center justify-between gap-6">
      <div className="min-w-0">
        <div className="text-xl font-semibold truncate">{title}</div>

        <div className="text-gray-600 mt-1">
          {city} • {venue}
          {startsLabel ? ` • ${startsLabel}` : ""}
        </div>

        <div className="text-gray-700 mt-2">
          {sector} • Fila {row} • Asiento {seat}
        </div>

        <div className="mt-3 flex items-center gap-3">
          <StatusPill status={status} />
          {statusDateLabel ? <span className="text-gray-500 text-sm">{statusDateLabel}</span> : null}
        </div>
      </div>

      <div className="flex flex-col items-end gap-3 shrink-0">
        <div className="text-2xl font-bold">
          ${Number(amount || 0).toLocaleString("es-CL")}
        </div>

        {/* Botón “Ver más” sin romperte nada: muestra/oculta detalles */}
        <DetailsToggle order={order} />
      </div>
    </div>
  );
}

function StatusPill({ status }) {
  // ajusta labels a tu gusto
  const map = {
    paid: { label: "paid", className: "bg-gray-100 text-gray-700" },
    pending: { label: "⏳ Pendiente", className: "bg-yellow-100 text-yellow-800 border border-yellow-200" },
    failed: { label: "Fallida", className: "bg-red-100 text-red-800" },
    cancelled: { label: "Cancelada", className: "bg-gray-100 text-gray-600" },
  };

  const cfg = map[status] || {
    label: status || "-",
    className: "bg-gray-100 text-gray-600",
  };

  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm ${cfg.className}`}>
      {cfg.label}
    </span>
  );
}

function DetailsToggle({ order }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="text-right">
      <button
        onClick={() => setOpen((v) => !v)}
        className="px-4 py-2 rounded-full bg-blue-600 text-white hover:bg-blue-700"
      >
        Ver más →
      </button>

      {open ? (
        <pre className="mt-3 text-xs bg-gray-50 border rounded p-3 max-w-[420px] overflow-auto text-left">
          {JSON.stringify(order, null, 2)}
        </pre>
      ) : null}
    </div>
  );
}

/** =========================
 *  Utils
 *  ========================= */

function toNumber(v) {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function formatDateCL(d) {
  // "10 feb 2026" (sin puntito)
  const s = new Intl.DateTimeFormat("es-CL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);

  return s.replace(/\./g, "").toLowerCase(); // "feb." -> "feb"
}


