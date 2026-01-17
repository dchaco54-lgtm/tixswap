// app/dashboard/purchases/[orderId]/page.jsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

function formatCLP(value) {
  const n = Number(value ?? 0);
  return n.toLocaleString("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  });
}

function formatDateTime(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleString("es-CL", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export default function PurchaseDetailPage() {
  const params = useParams();
  const orderId = params?.orderId;

  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState(null);
  const [error, setError] = useState(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  useEffect(() => {
    if (!orderId) return;

    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.access_token) {
          setOrder(null);
          setError("Debes iniciar sesión.");
          return;
        }

        const res = await fetch(`/api/orders/${orderId}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });

        const data = await res.json();

        if (!res.ok) throw new Error(data?.error || "No se pudo cargar la compra.");

        if (!cancelled) setOrder(data.order || null);
      } catch (e) {
        console.error(e);
        if (!cancelled) setError("No se pudo cargar el detalle de la compra.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  async function handleDownloadPdf() {
    if (!order?.ticket_id) return;
    try {
      setDownloadingPdf(true);
      const res = await fetch(`/api/tickets/${order.ticket_id}/pdf`, { cache: "no-store" });
      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(json?.error || "No se pudo generar el PDF.");
      }

      if (!json?.signedUrl) {
        throw new Error("No se encontró el PDF para este ticket.");
      }

      window.open(json.signedUrl, "_blank", "noopener,noreferrer");
    } catch (e) {
      console.error(e);
      alert(e?.message || "No se pudo descargar el PDF.");
    } finally {
      setDownloadingPdf(false);
    }
  }

  const ticket = order?.ticket;
  const event = ticket?.event || order?.event;
  const seller = ticket?.seller || order?.seller;

  const ticketPrice = Number(order?.amount_clp ?? 0);
  const platformFee = Number(order?.fee_clp ?? 0);
  const totalPaid = Number(order?.total_paid_clp ?? order?.total_clp ?? 0);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Link href="/dashboard/purchases" className="text-blue-600 hover:underline">
          ← Volver a Mis compras
        </Link>

        <div className="mt-6">
          {loading ? (
            <div className="bg-white rounded-2xl shadow p-6">Cargando...</div>
          ) : error ? (
            <div className="bg-white rounded-2xl shadow p-6">
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3">
                {error}
              </div>
            </div>
          ) : !order ? (
            <div className="bg-white rounded-2xl shadow p-6 text-gray-600">
              No hay información para mostrar.
            </div>
          ) : (
            <div className="space-y-6">
              {/* Header con estado */}
              <div className="bg-white rounded-2xl shadow p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h1 className="text-2xl font-bold">Detalle de compra</h1>
                    <p className="text-gray-600 mt-1">
                      Orden: <span className="font-mono">{order.id}</span>
                    </p>
                    <p className="text-gray-600">
                      {order.created_at ? formatDateTime(order.created_at) : ""}
                    </p>
                  </div>
                  <span
                    className={`inline-flex items-center rounded-full px-4 py-2 text-sm font-medium ${
                      order.payment_state === "paid" || order.status === "completed"
                        ? "bg-green-50 text-green-700 border border-green-200"
                        : order.status === "pending"
                        ? "bg-yellow-50 text-yellow-700 border border-yellow-200"
                        : "bg-gray-50 text-gray-700 border border-gray-200"
                    }`}
                  >
                    {order.payment_state === "paid" || order.status === "completed"
                      ? "✓ Pagado"
                      : order.status === "pending"
                      ? "⏳ Pendiente"
                      : order.status || "—"}
                  </span>
                </div>
              </div>

              {/* Evento */}
              <div className="bg-white rounded-2xl shadow p-6">
                <h2 className="text-lg font-semibold mb-4">Evento</h2>
                <div className="flex gap-4 items-start">
                  {event?.image_url && (
                    <img
                      src={event.image_url}
                      alt={event.title || "Evento"}
                      className="w-32 h-32 rounded-xl object-cover flex-shrink-0"
                    />
                  )}
                  <div>
                    <div className="text-xl font-semibold">{event?.title || "Evento"}</div>
                    {event?.starts_at && (
                      <div className="text-gray-600 mt-1">{formatDateTime(event.starts_at)}</div>
                    )}
                    <div className="text-gray-600">
                      {[event?.venue, event?.city].filter(Boolean).join(" • ")}
                    </div>
                    {event?.warnings && (
                      <div className="mt-3 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2 text-sm text-yellow-800">
                        ⚠️ {event.warnings}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Entrada */}
              <div className="bg-white rounded-2xl shadow p-6">
                <h2 className="text-lg font-semibold mb-4">Tu entrada</h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                  {ticket?.section && (
                    <div>
                      <div className="text-gray-500">Sección</div>
                      <div className="font-medium text-lg">{ticket.section}</div>
                    </div>
                  )}
                  {ticket?.row && (
                    <div>
                      <div className="text-gray-500">Fila</div>
                      <div className="font-medium text-lg">{ticket.row}</div>
                    </div>
                  )}
                  {ticket?.seat && (
                    <div>
                      <div className="text-gray-500">Asiento</div>
                      <div className="font-medium text-lg">{ticket.seat}</div>
                    </div>
                  )}
                </div>
                {ticket?.notes && (
                  <div className="mt-4 text-sm text-gray-600">
                    <span className="font-medium">Notas:</span> {ticket.notes}
                  </div>
                )}
              </div>

              {/* Vendedor */}
              <div className="bg-white rounded-2xl shadow p-6">
                <h2 className="text-lg font-semibold mb-4">Vendedor</h2>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="font-medium text-lg">
                      {seller?.full_name || seller?.email || "Usuario"}
                    </div>
                    {seller?.email && (
                      <div className="text-gray-600 text-sm">{seller.email}</div>
                    )}
                  </div>
                  <button
                    disabled
                    className="px-4 py-2 rounded-xl bg-gray-200 text-gray-500 font-semibold cursor-not-allowed"
                    title="Sistema de chat en desarrollo"
                  >
                    💬 Abrir Chat (próximamente)
                  </button>
                </div>
              </div>

              {/* Resumen de valores */}
              <div className="bg-white rounded-2xl shadow p-6">
                <h2 className="text-lg font-semibold mb-4">Resumen de pago</h2>
                <div className="space-y-3">
                  <div className="flex justify-between text-gray-700">
                    <span>Precio entrada</span>
                    <span className="font-medium">{formatCLP(ticketPrice)}</span>
                  </div>
                  <div className="flex justify-between text-gray-700">
                    <span>Cargo TixSwap</span>
                    <span className="font-medium">{formatCLP(platformFee)}</span>
                  </div>
                  <div className="border-t pt-3 flex justify-between text-lg font-bold">
                    <span>Total pagado</span>
                    <span>{formatCLP(totalPaid)}</span>
                  </div>
                </div>
              </div>

              {/* Acciones */}
              <div className="bg-white rounded-2xl shadow p-6">
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={handleDownloadPdf}
                    disabled={!order?.ticket_id || downloadingPdf}
                    className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {downloadingPdf ? "Generando PDF..." : "📄 Descargar entrada PDF"}
                  </button>

                  {event?.id && (
                    <Link
                      href={`/events/${event.id}`}
                      className="px-6 py-3 rounded-xl border border-gray-300 hover:bg-gray-50 font-semibold"
                    >
                      Ver evento
                    </Link>
                  )}
                </div>
              </div>

              {/* Recomendaciones */}
              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6">
                <h3 className="font-semibold text-blue-900 mb-2">💡 Recomendaciones</h3>
                <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                  <li>No hagas transacciones fuera de la plataforma</li>
                  <li>Recuerda: no entregues tus claves ni PIN al vendedor</li>
                  <li>Siempre pide el PDF de la entrada al vendedor</li>
                  <li>Verifica que el evento y la ubicación coincidan con lo publicado</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
