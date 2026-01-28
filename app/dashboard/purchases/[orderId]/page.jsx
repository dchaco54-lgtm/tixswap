// app/dashboard/purchases/[orderId]/page.jsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import OrderChat from "@/app/components/OrderChat";
import RatingModal from "@/components/RatingModal";
import StarRating from "@/components/StarRating";

function formatCLP(n) {
  const value = Number(n || 0);
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(value);
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
  if (s === "paid")
    return {
      text: "Pagada",
      cls: "bg-emerald-50 text-emerald-700 border-emerald-200",
    };
  if (s === "pending")
    return {
      text: "Pendiente",
      cls: "bg-amber-50 text-amber-700 border-amber-200",
    };
  return {
    text: order?.status || "Estado",
    cls: "bg-slate-50 text-slate-700 border-slate-200",
  };
}

export default function PurchaseDetailPage() {
  const { orderId } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [chatOpen, setChatOpen] = useState(false);
  const [ratingOpen, setRatingOpen] = useState(false);
  const [ratingSubmitting, setRatingSubmitting] = useState(false);
  const [ratingError, setRatingError] = useState("");
  const [myRating, setMyRating] = useState(null);

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

  const canChat = !!order?.id;
  const canDownload =
    (order?.status || "").toLowerCase() === "paid" ||
    String(order?.payment_state || "").toUpperCase() === "AUTHORIZED";

  const pdfHref = order ? `/api/orders/${order.id}/pdf` : "#";
  const canRate = String(t?.status || "").toLowerCase() === "sold";
  const hasRated = Boolean(myRating?.id);
  const isNominated = Boolean(
    order?.renominated_storage_path ||
      t?.is_nominated ||
      t?.is_nominada ||
      String(t?.sale_type || "").toLowerCase().includes("nomin")
  );
  const hoursToEvent = e?.starts_at
    ? (new Date(e.starts_at).getTime() - Date.now()) / (1000 * 60 * 60)
    : null;
  const isUrgent = isNominated && !order?.renominated_storage_path && hoursToEvent !== null && hoursToEvent <= 48 && hoursToEvent > 0;

  useEffect(() => {
    let cancelled = false;

    async function loadRating() {
      if (!order?.id || !canRate) {
        if (!cancelled) setMyRating(null);
        return;
      }
      try {
        const res = await fetch(
          `/api/ratings?orderId=${order.id}&role=buyer`,
          { cache: "no-store" }
        );
        const json = await res.json().catch(() => ({}));
        if (!cancelled) setMyRating(res.ok ? json?.rating || null : null);
      } catch {
        if (!cancelled) setMyRating(null);
      }
    }

    loadRating();
    return () => {
      cancelled = true;
    };
  }, [order?.id, canRate]);

  const handleSubmitRating = async ({ stars, comment }) => {
    if (!order?.id) return;
    setRatingError("");
    setRatingSubmitting(true);
    try {
      const res = await fetch("/api/ratings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: order.id,
          role: "buyer",
          stars,
          comment,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "No se pudo calificar");
      setMyRating(json?.rating || null);
      setRatingOpen(false);
    } catch (e) {
      setRatingError(e?.message || "No se pudo calificar");
    } finally {
      setRatingSubmitting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link
            href="/dashboard/purchases"
            className="text-sm text-slate-600 hover:underline"
          >
            ← Volver a Mis compras
          </Link>
          <h1 className="text-2xl font-semibold mt-2">Detalle de compra</h1>
        </div>

        {order ? (
          <span
            className={`inline-flex items-center rounded-full border px-3 py-1 text-xs ${badge.cls}`}
          >
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
          {/* Main */}
          <div className="lg:col-span-2 space-y-6">
            {/* Header Evento */}
            <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
              <div className="relative h-52 bg-slate-100">
                {e?.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={e.image_url}
                    alt={e?.title || "Evento"}
                    className="w-full h-full object-cover"
                  />
                ) : null}

                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-5 text-white">
                  <div className="text-xl font-semibold">
                    {e?.title || "Evento"}
                  </div>
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

              {isNominated ? (
                <div
                  className={`mb-3 rounded-xl border px-3 py-2 text-xs ${
                    isUrgent
                      ? "border-red-200 bg-red-50 text-red-800"
                      : "border-amber-200 bg-amber-50 text-amber-800"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <span className="text-base leading-none">⚠️</span>
                    <div>
                      <span className="font-semibold">Entrada nominada.</span>{" "}
                      El vendedor tiene hasta 5 días para subir el PDF re-nominado.
                      <span className="block mt-1">
                        Puedes escribirle por el chat y descargar la nueva entrada cuando esté lista.
                      </span>
                      {isUrgent ? (
                        <span className="block mt-1">
                          Faltan menos de 48 horas para el evento. Si no recibes la re-nominación,
                          contacta a Soporte para evaluar la cancelación.
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="flex flex-col sm:flex-row gap-3">
                <a
                  href={pdfHref}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(ev) => {
                    if (!canDownload) ev.preventDefault();
                  }}
                  className={`inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm ${
                    canDownload
                      ? "bg-blue-600 text-white hover:bg-blue-700"
                      : "bg-slate-200 text-slate-500 cursor-not-allowed"
                  }`}
                >
                  Descargar PDF
                </a>

                <button
                  type="button"
                  onClick={() => setChatOpen(true)}
                  disabled={!canChat}
                  className={`inline-flex items-center justify-center rounded-xl border px-4 py-2 text-sm hover:bg-slate-50 ${
                    canChat ? "" : "opacity-50 cursor-not-allowed"
                  }`}
                >
                  Abrir chat con vendedor
                </button>

                <Link
                  href="/support"
                  className="inline-flex items-center justify-center rounded-xl border px-4 py-2 text-sm hover:bg-slate-50"
                >
                  Soporte
                </Link>

                <button
                  type="button"
                  onClick={() => setRatingOpen(true)}
                  disabled={!canRate || hasRated}
                  className={`inline-flex items-center justify-center rounded-xl border px-4 py-2 text-sm ${
                    !canRate
                      ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                      : hasRated
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200 cursor-not-allowed"
                      : "bg-white hover:bg-slate-50"
                  }`}
                >
                  {hasRated ? "Calificado" : "Calificar"}
                </button>
              </div>

              {hasRated ? (
                <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                  <div className="font-semibold text-slate-700 mb-1">Tu calificación</div>
                  <StarRating value={Number(myRating.stars || 0)} text={`${myRating.stars}/5`} size={14} />
                  <div className="mt-1 text-slate-600">
                    {myRating.comment || "Sin comentario"}
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <div className="rounded-2xl border bg-white p-5 shadow-sm">
              <div className="text-base font-semibold text-slate-900 mb-2">Resumen</div>

              <div className="flex items-center justify-between py-2 text-sm">
                <span className="text-slate-600">Total</span>
                <span className="font-semibold">
                  {formatCLP(order.total_clp ?? order.amount_clp)}
                </span>
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
                Orden:{" "}
                <span className="font-mono">{order.buy_order || "-"}</span>
              </div>
            </div>

            <div className="rounded-2xl border bg-white p-5 shadow-sm">
              <div className="text-lg font-semibold mb-3">Vendedor</div>
              <div className="text-sm">
                <div className="font-semibold">{t?.seller_name || "Vendedor"}</div>
              </div>

              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => setChatOpen(true)}
                  disabled={!canChat}
                  className={`inline-flex w-full items-center justify-center rounded-xl border px-4 py-2 text-sm hover:bg-slate-50 ${
                    canChat ? "" : "opacity-50 cursor-not-allowed"
                  }`}
                >
                  Hablar por chat
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Chat modal */}
      {chatOpen && order?.id ? (
        <OrderChat orderId={order.id} onClose={() => setChatOpen(false)} />
      ) : null}

      <RatingModal
        open={ratingOpen}
        title="Calificar como comprador"
        onClose={() => {
          if (!ratingSubmitting) {
            setRatingOpen(false);
            setRatingError("");
          }
        }}
        onSubmit={handleSubmitRating}
        submitting={ratingSubmitting}
        error={ratingError}
      />
    </div>
  );
}
