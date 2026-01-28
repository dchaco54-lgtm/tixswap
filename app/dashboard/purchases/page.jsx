// app/dashboard/purchases/page.jsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

function formatCLP(n) {
  const value = Number(n || 0);
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP" }).format(value);
}

function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return new Intl.DateTimeFormat("es-CL", { day: "2-digit", month: "short", year: "numeric" }).format(d);
}

function statusLabel(o) {
  const s = (o?.status || "").toLowerCase();
  if (s === "paid") return { text: "Pagada", className: "bg-emerald-50 text-emerald-700 border-emerald-200" };
  if (s === "pending") return { text: "Pendiente", className: "bg-amber-50 text-amber-700 border-amber-200" };
  return { text: o?.status || "Estado", className: "bg-slate-50 text-slate-700 border-slate-200" };
}

export default function PurchasesPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  async function load() {
    setErr("");
    setLoading(true);
    try {
      const res = await fetch("/api/orders/my", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Error cargando compras");
      setOrders(json?.orders || []);
    } catch (e) {
      setErr(e.message);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const empty = useMemo(() => !loading && !err && orders.length === 0, [loading, err, orders]);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Mis compras</h1>
        <button
          onClick={load}
          className="rounded-lg border px-4 py-2 text-sm hover:bg-slate-50"
        >
          Refrescar
        </button>
      </div>

      {err ? (
        <div className="rounded-xl border border-red-200 bg-red-50 text-red-700 p-4">
          {err}
        </div>
      ) : null}

      {loading ? (
        <div className="grid gap-4">
          <div className="h-28 rounded-2xl border animate-pulse" />
          <div className="h-28 rounded-2xl border animate-pulse" />
        </div>
      ) : null}

      {empty ? (
        <div className="rounded-2xl border p-6 text-slate-600">
          Aún no tienes compras.
        </div>
      ) : null}

      <div className="grid gap-4">
        {orders.map((o) => {
          const t = o.ticket;
          const e = o.event;
          const badge = statusLabel(o);

          return (
            <div key={o.id} className="rounded-2xl border bg-white p-5 shadow-sm">
              <div className="flex gap-4">
                <div className="w-24 h-24 rounded-xl overflow-hidden bg-slate-100 shrink-0">
                  {e?.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={e.image_url}
                      alt={e?.title || "Evento"}
                      className="w-full h-full object-cover"
                    />
                  ) : null}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-lg font-semibold truncate">{e?.title || "Compra"}</div>
                      <div className="text-sm text-slate-600">
                        {e?.city ? `${e.city} · ` : ""}
                        {e?.venue ? `${e.venue} · ` : ""}
                        {e?.starts_at ? formatDate(e.starts_at) : ""}
                      </div>
                      <div className="text-sm text-slate-600 mt-1">
                        {t?.sector ? `Sector ${t.sector}` : ""}
                        {t?.row_label ? ` · Fila ${t.row_label}` : ""}
                        {t?.seat_label ? ` · Asiento ${t.seat_label}` : ""}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-xl font-semibold">{formatCLP(o.total_clp ?? o.amount_clp)}</div>
                      <Link
                        href={`/dashboard/purchases/${o.id}`}
                        className="inline-flex items-center justify-center mt-2 rounded-xl bg-blue-600 text-white px-4 py-2 text-sm hover:bg-blue-700"
                      >
                        Ver más →
                      </Link>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs ${badge.className}`}>
                      {badge.text}
                      <span className="text-slate-400">·</span>
                      <span className="text-slate-500">{formatDate(o.created_at)}</span>
                    </span>
                    {t?.is_nominated ? (
                      <span className="inline-flex items-center rounded-full border px-3 py-1 text-xs bg-amber-50 text-amber-800 border-amber-200">
                        Nominada
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

