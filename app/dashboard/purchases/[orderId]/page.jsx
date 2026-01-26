// app/dashboard/purchases/[orderId]/page.jsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

function formatCLP(n) {
  const value = Number(n || 0);
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP" }).format(value);
}

function formatDateLong(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return new Intl.DateTimeFormat("es-CL", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function statusBadge(order) {
  const s = (order?.status || "").toLowerCase();
  if (s === "paid") return { text: "Pagada", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" };
  if (s === "pending") return { text: "Pendiente", cls: "bg-amber-50 text-amber-700 border-amber-200" };
  return { text: order?.status || "Estado", cls: "bg-slate-50 text-slate-700 border-slate-200" };
}

export default function PurchaseDetailPage() {
  const { orderId } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  async function load() {
    setErr("");
    setLoading(true);
    try {
      const res = await fetch(`/api/orders/${orderId}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Error cargando detalle");
      setOrder(json?.order || null);
    } catch (e) {
      setErr(e.message);
      setOrder(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (orderId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  const t = order?.ticket;
  const e = order?.event;
  const badge = useMemo(() => statusBadge(order), [order]);

  // Ajusta estos links a tus rutas reales:
  const chatHref = order ? `/dashboard/chat?orderId=${order.id}&to=${order.seller_id}` : "#";
  const pdfHref = t ? `/api/tickets/${t.id}/pdf` : "#"; // <-- cambia a tu endpoint real de descarga

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link href="/dashboard/purchases" className="text-sm text-slate-600 hover:underline">
            ← Volver a Mis compras
          </Link>
          <h1 className="text-2xl font-semibold mt-2">Detalle de compra</h1>
        </div>

        {order ? (
          <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs ${badge.cls}`}>
            {badge.text}
          </span>
        ) : null}
      </div>

      {err ? (
        <div className="rounded-xl border border-red-200 bg-red-50 text-red-700 p-4">
          {err}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-2xl border bg-white p-6 shadow-sm animate-pulse h-64" />
      ) : null}

      {!loading && order ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Columna principal */}
          <div className="lg:col-span-2 space-y-6">
            {/* Header evento */}
            <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
              <div className="relative h-48 bg-slate-100">
                {e?.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={e.image_url} alt={e?.title || "Evento"} className="w-full h-full object-cover" />
                ) : null}

                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-5 text-white">
                  <div className="text-xl font-semibold">{e?.title || "Evento"}</div>
                  <div className="text-sm text-white/90">
                    {e?.city ? `${e.city} · ` : ""}
                    {e?.venue ? `${e.venue} · ` : ""}
                    {e?.starts_at ? formatDateLong(e.starts_at) : ""}
                  </div>
                </div>
              </div>

              <div className="p-5">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="rounded-xl border p-4">
                    <div className="text-xs text-slate-500">Sector</div>
                    <div className="font-semibold">{t?.sector || "-"}</div>
                  </div>
                  <div className="rounded-xl border p-4">
                    <div className="text-xs text-slate-500">Fila</div>
                    <div className="font-semibold">{t?.row_label || "-"}</div>
                  </div>
                  <div className="rounded-xl border p-4">
                    <div className="text-xs text-slate-500">Asiento</div>
                    <div className="font-semibold">{t?.seat_label || "-"}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Acciones */}
            <div className="rounded-2xl border bg-white p-5 shadow-sm">
              <div className="text-lg font-semibold mb-1">Acciones</div>
              <div className="text-sm text-slate-600 mb-4">
                Descarga tu entrada y contacta al vendedor cuando quieras.
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <a
                  href={pdfHref}
                  className="inline-flex items-center justify-center rounded-xl bg-blue-600 text-white px-4 py-2 text-sm hover:bg-blue-700"
                  target="_blank"
                  rel="noreferrer"
                >
                  Descargar PDF
                </a>

                <Link
                  href={chatHref}
                  className="inline-flex items-center justify-center rounded-xl border px-4 py-2 text-sm hover:bg-slate-50"
                >
                  Abrir chat con vendedor
                </Link>

                <Link
                  href="/support"
                  className="inline-flex items-center justify-center rounded-xl border px-4 py-2 text-sm hover:bg-slate-50"
                >
                  Soporte
                </Link>
              </div>

              <div className="mt-4 text-xs text-slate-500">
                * Si tu descarga real no es <code>/api/tickets/[id]/pdf</code>, cámbialo arriba (pdfHref).
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <div className="rounded-2xl border bg-white p-5 shadow-sm">
              <div className="text-lg font-semibold mb-3">Resumen</div>

              <div className="flex items-center justify-between py-2 text-sm">
                <span className="text-slate-600">Total</span>
                <span className="font-semibold">{formatCLP(order.total_clp ?? order.amount_clp)}</span>
              </div>

              <div className="flex items-center justify-between py-2 text-sm">
                <span className="text-slate-600">Entrada</span>
                <span className="font-medium">{formatCLP(order.amount_clp)}</span>
              </div>

              <div className="flex items-center justify-between py-2 text-sm">
                <span className="text-slate-600">Fee</span>
                <span className="font-medium">{formatCLP(order.fee_clp)}</span>
              </div>

              <div className="mt-3 pt-3 border-t text-xs text-slate-500">
                Orden: <span className="font-mono">{order.buy_order || "-"}</span>
              </div>
              <div className="mt-1 text-xs text-slate-500">
                Webpay: <span className="font-mono">{order.webpay_token ? `${order.webpay_token.slice(0, 10)}...` : "-"}</span>
              </div>
            </div>

            <div className="rounded-2xl border bg-white p-5 shadow-sm">
              <div className="text-lg font-semibold mb-3">Vendedor</div>
              <div className="text-sm">
                <div className="font-semibold">{t?.seller_name || "Vendedor"}</div>
                <div className="text-slate-600">{t?.seller_email || ""}</div>
                <div className="text-slate-500 text-xs mt-1">RUT: {t?.seller_rut || "-"}</div>
              </div>

              <div className="mt-4">
                <Link
                  href={chatHref}
                  className="inline-flex w-full items-center justify-center rounded-xl border px-4 py-2 text-sm hover:bg-slate-50"
                >
                  Hablar por chat
                </Link>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

