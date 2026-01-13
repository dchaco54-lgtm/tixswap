'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

function formatCLP(value) {
  const n = Number(value ?? 0);
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(n);
}

function Stars({ value }) {
  const v = Number(value);
  if (!Number.isFinite(v)) return <span className="text-gray-500">—</span>;

  const rounded = Math.round(v * 10) / 10; // 4.2
  return (
    <span className="inline-flex items-center gap-2">
      <span className="text-yellow-500">★</span>
      <span className="font-medium">{rounded}</span>
    </span>
  );
}

export default function CheckoutPage() {
  const { ticketId } = useParams();
  const router = useRouter();

  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showReviews, setShowReviews] = useState(false);

  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        setLoading(true);
        setError('');

        const res = await fetch('/api/checkout/preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ticketId }),
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          throw new Error(data?.error || 'No se pudo cargar el resumen');
        }

        if (alive) setPreview(data);
      } catch (e) {
        if (alive) setError(e?.message || 'Error al obtener resumen');
      } finally {
        if (alive) setLoading(false);
      }
    }

    if (ticketId) load();
    return () => {
      alive = false;
    };
  }, [ticketId]);

  const breakdown = useMemo(() => {
    if (!preview) return null;
    const subtotal = Number(preview?.totals?.subtotal ?? 0);
    const fee = Number(preview?.fees?.platformFee ?? 0);
    const total = Number(preview?.totals?.total ?? subtotal + fee);

    return { subtotal, fee, total };
  }, [preview]);

  async function startPayment() {
    try {
      setError('');
      const res = await fetch('/api/payments/webpay/create-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticketId }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) throw new Error(data?.error || 'No se pudo iniciar el pago');

      if (data?.url) {
        window.location.href = data.url;
        return;
      }

      throw new Error('Respuesta inválida del pago');
    } catch (e) {
      setError(e?.message || 'Error al iniciar pago');
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-bold mb-2">Checkout</h1>
      <p className="text-gray-600 mb-8">Revisa el resumen y elige tu medio de pago.</p>

      <div className="mb-6">
        <button
          className="text-blue-600 hover:underline"
          onClick={() => router.back()}
        >
          Volver
        </button>
      </div>

      {loading && (
        <div className="rounded-lg border bg-white p-6 text-gray-600">
          Cargando resumen...
        </div>
      )}

      {!loading && error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700 mb-6">
          {error}
        </div>
      )}

      {!loading && !error && preview && (
        <div className="space-y-6">
          {/* Ticket + Evento */}
          <div className="rounded-xl border bg-white p-6">
            <h2 className="text-xl font-semibold mb-4">Detalle del ticket</h2>

            <div className="space-y-2">
              <div className="font-semibold text-lg">
                {preview?.ticket?.title || 'Ticket'}
              </div>

              {preview?.event?.title && (
                <div className="text-gray-700">
                  <span className="font-medium">{preview.event.title}</span>
                  {preview?.event?.venue ? ` · ${preview.event.venue}` : ''}
                  {preview?.event?.city ? ` · ${preview.event.city}` : ''}
                </div>
              )}

              <div className="text-gray-700">
                {preview?.ticket?.sector ? (
                  <span>
                    <span className="font-medium">Sección:</span>{' '}
                    {preview.ticket.sector}
                  </span>
                ) : (
                  <span className="text-gray-500">Sección: —</span>
                )}
                {preview?.ticket?.row_label ? (
                  <span> · <span className="font-medium">Fila:</span> {preview.ticket.row_label}</span>
                ) : null}
                {preview?.ticket?.seat_label ? (
                  <span> · <span className="font-medium">Asiento:</span> {preview.ticket.seat_label}</span>
                ) : null}
              </div>

              {preview?.ticket?.description ? (
                <div className="text-gray-600">{preview.ticket.description}</div>
              ) : null}

              <div className="pt-3 text-2xl font-bold">
                {formatCLP(preview?.ticket?.price)}
              </div>
            </div>
          </div>

          {/* Vendedor + reputación */}
          <div className="rounded-xl border bg-white p-6">
            <h2 className="text-xl font-semibold mb-4">Vendedor</h2>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="font-semibold">{preview?.seller?.name || 'Vendedor'}</div>
                {preview?.seller?.tier ? (
                  <div className="text-gray-600 text-sm">Tier: {preview.seller.tier}</div>
                ) : (
                  <div className="text-gray-500 text-sm">Tier: —</div>
                )}
              </div>

              <div className="text-right">
                <div className="text-sm text-gray-600">Reputación</div>
                <div className="text-lg">
                  <Stars value={preview?.seller?.rating_avg} />{' '}
                  <span className="text-gray-600 text-sm">
                    ({preview?.seller?.rating_count ?? 0})
                  </span>
                </div>
              </div>
            </div>

            {!!preview?.seller?.recent_ratings?.length && (
              <div className="mt-4">
                <button
                  onClick={() => setShowReviews((v) => !v)}
                  className="text-blue-600 hover:underline"
                >
                  {showReviews ? 'Ocultar comentarios' : 'Ver comentarios'}
                </button>

                {showReviews && (
                  <div className="mt-4 space-y-3">
                    {preview.seller.recent_ratings.map((r, idx) => (
                      <div key={idx} className="rounded-lg border p-3">
                        <div className="flex items-center justify-between">
                          <div className="font-medium">{r.rater_name || 'Usuario'}</div>
                          <div className="text-yellow-500">★ {r.stars}</div>
                        </div>
                        {r.comment ? (
                          <div className="text-gray-700 mt-1">{r.comment}</div>
                        ) : (
                          <div className="text-gray-500 mt-1">Sin comentario</div>
                        )}
                        {r.created_at ? (
                          <div className="text-xs text-gray-500 mt-2">
                            {new Date(r.created_at).toLocaleDateString('es-CL')}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Resumen de pago */}
          <div className="rounded-xl border bg-white p-6">
            <h2 className="text-xl font-semibold mb-4">Resumen</h2>

            <div className="space-y-2 text-gray-800">
              <div className="flex items-center justify-between">
                <span>Entrada</span>
                <span>{formatCLP(breakdown.subtotal)}</span>
              </div>

              <div className="flex items-center justify-between">
                <span>
                  Comisión TixSwap{' '}
                  <span className="text-gray-500 text-sm">
                    (2,5% · mínimo {formatCLP(1200)})
                  </span>
                </span>
                <span>{formatCLP(breakdown.fee)}</span>
              </div>

              <div className="border-t pt-3 flex items-center justify-between font-bold text-lg">
                <span>Total</span>
                <span>{formatCLP(breakdown.total)}</span>
              </div>
            </div>

            <div className="mt-5 text-sm text-gray-600">
              El pago se procesa por <span className="font-medium">Webpay</span>. Ahí eliges
              débito/crédito (y lo que Transbank tenga disponible).
            </div>

            <button
              onClick={startPayment}
              className="mt-6 w-full rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-700"
            >
              Pagar con Webpay
            </button>
          </div>
        </div>
      )}
    </div>
  );
}



