// app/dashboard/purchases/page.jsx
"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

function formatCLP(value) {
  const n = Number(value ?? 0);
  if (Number.isNaN(n)) return "$0";
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(n);
}

function formatDateCL(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("es-CL", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(d);
}

function PurchasesContent() {
  const searchParams = useSearchParams();
  const paymentStatus = searchParams.get("payment");
  const orderId = searchParams.get("order");
  
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadOrders() {
    try {
      setLoading(true);
      setError("");

      const res = await fetch("/api/orders/my", { 
        cache: "no-store",
        credentials: "include" // Asegurar que envía cookies
      });
      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        // Si viene de Webpay con éxito pero no tiene sesión, no es crítico
        if (paymentStatus === "success") {
          setError("");
          setOrders([]);
          setLoading(false);
          return;
        }
        throw new Error(json?.error || "No se pudieron cargar las compras.");
      }

      setOrders(Array.isArray(json.orders) ? json.orders : []);
    } catch (e) {
      console.error(e);
      // Si viene de pago exitoso, no mostramos error
      if (paymentStatus === "success") {
        setError("");
        setOrders([]);
      } else {
        setError(e?.message || "No se pudieron cargar las compras.");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadOrders();
  }, []);

  const normalized = useMemo(() => {
    return (orders || []).map((o) => {
      const ticket = o.ticket || null;
      const event = o.event || ticket?.event || null;

      const eventTitle = event?.title ?? event?.name ?? "Evento";
      const eventWhen = formatDateCL(event?.starts_at ?? event?.date ?? null);
      const eventWhere = [event?.city, event?.venue].filter(Boolean).join(" • ");

      const sector = ticket?.sector ?? ticket?.section ?? null;
      const rowLabel = ticket?.row_label ?? ticket?.row ?? ticket?.fila ?? null;
      const seatLabel = ticket?.seat_label ?? ticket?.seat ?? ticket?.asiento ?? null;

      const seatText = [
        sector ? `Sector ${sector}` : null,
        rowLabel ? `Fila ${rowLabel}` : null,
        seatLabel ? `Asiento ${seatLabel}` : null,
      ]
        .filter(Boolean)
        .join(" • ");

      return {
        ...o,
        _eventTitle: eventTitle,
        _eventWhen: eventWhen,
        _eventWhere: eventWhere,
        _seatText: seatText,
      };
    });
  }, [orders]);

  async function handleDownloadPdf(ticketId) {
    try {
      if (!ticketId) return;

      const res = await fetch(`/api/tickets/${ticketId}/pdf`, { cache: "no-store" });
      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(json?.error || "No se pudo generar el link del PDF.");
      }

      if (!json?.signedUrl) {
        throw new Error("No se encontró el PDF para este ticket.");
      }

      window.open(json.signedUrl, "_blank", "noopener,noreferrer");
    } catch (e) {
      console.error(e);
      alert(e?.message || "No se pudo descargar el PDF.");
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="text-sm text-blue-600 hover:underline">
              ← Volver al panel
            </Link>
            <span className="text-gray-300">|</span>
            <Link href="/events" className="text-sm text-blue-600 hover:underline">
              Ir a comprar
            </Link>
          </div>

          <h1 className="text-lg font-semibold">Mis compras</h1>

          <button
            onClick={loadOrders}
            className="text-sm px-3 py-2 rounded-lg border hover:bg-gray-50"
            disabled={loading}
          >
            Refrescar
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Mensaje de éxito de pago */}
        {paymentStatus === "success" && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <h2 className="text-lg font-semibold text-green-800 mb-2">
              ✅ ¡Pago exitoso!
            </h2>
            <p className="text-green-700 mb-3">
              Tu compra se procesó correctamente. Recibirás un email con los detalles.
            </p>
            {orderId && (
              <p className="text-sm text-green-600">
                ID de orden: {orderId}
              </p>
            )}
            <div className="mt-4">
              <Link 
                href="/login" 
                className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Iniciar sesión para ver tus compras
              </Link>
            </div>
          </div>
        )}

        {paymentStatus === "canceled" && (
          <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <h2 className="text-lg font-semibold text-yellow-800">
              ⚠️ Pago cancelado
            </h2>
            <p className="text-yellow-700">
              Cancelaste el pago en Webpay. El ticket fue liberado.
            </p>
          </div>
        )}

        {paymentStatus === "failed" && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <h2 className="text-lg font-semibold text-red-800">
              ❌ Pago rechazado
            </h2>
            <p className="text-red-700">
              El pago fue rechazado por Webpay. Intenta nuevamente.
            </p>
          </div>
        )}

        {loading ? (
          <div className="text-gray-600">Cargando compras...</div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4">
            {error}
          </div>
        ) : normalized.length === 0 ? (
          <div className="bg-white rounded-2xl shadow p-6 text-gray-600">
            Aún no tienes compras.
          </div>
        ) : (
          <div className="grid gap-4">
            {normalized.map((o) => (
              <div key={o.id} className="bg-white rounded-2xl shadow p-6">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                  <div>
                    <div className="text-xl font-semibold">{o._eventTitle}</div>
                    <div className="text-gray-600">
                      {[o._eventWhere, o._eventWhen].filter(Boolean).join(" • ")}
                    </div>

                    {o._seatText && (
                      <div className="text-gray-600 mt-2">{o._seatText}</div>
                    )}

                    <div className="text-sm text-gray-500 mt-2">
                      Orden: <span className="font-mono">{o.id}</span>
                    </div>

                    <div className="text-sm text-gray-500">
                      Estado: <span className="font-semibold">{o.status ?? "—"}</span>
                      {o.created_at ? (
                        <>
                          {" "}
                          • Comprado:{" "}
                          <span className="font-semibold">
                            {formatDateCL(o.created_at)}
                          </span>
                        </>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex flex-col items-start md:items-end gap-3">
                    <div className="text-2xl font-bold">
                      {formatCLP(o.total_paid_clp ?? o.total_clp ?? o.amount_clp)}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => handleDownloadPdf(o.ticket_id)}
                        className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                        disabled={!o.ticket_id}
                        title={!o.ticket_id ? "Esta compra no tiene ticket_id asociado." : "Descargar tu entrada en PDF"}
                      >
                        Descargar PDF
                      </button>

                      <Link
                        href={`/dashboard/soporte?new=1&category=disputa_compra&subject=${encodeURIComponent(
                          `Compra ${o.id}`
                        )}&message=${encodeURIComponent(
                          `Hola! Necesito hablar con el vendedor por mi compra.\n\nOrden: ${o.id}\nTicket: ${o.ticket_id || "—"}\nVendedor: ${o.seller_id || "—"}\n\n(Escribe tu mensaje acá)`
                        )}`}
                        className="px-4 py-2 rounded-xl border hover:bg-gray-50 font-semibold"
                      >
                        Chat con vendedor
                      </Link>
                    </div>

                    {o.event_id && (
                      <Link
                        href={`/events/${o.event_id}`}
                        className="text-sm text-blue-600 hover:underline"
                      >
                        Ver evento
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

export default function PurchasesPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center">Cargando...</div>}>
      <PurchasesContent />
    </Suspense>
  );
}
