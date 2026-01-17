'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { formatPrice } from '@/lib/fees';

function formatDateTime(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleString('es-CL', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

export default function CheckoutPage() {
  const router = useRouter();
  const { ticketId } = useParams();
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState(null);
  const [preview, setPreview] = useState(null);
  const [showSellerComments, setShowSellerComments] = useState(false);

  const ticket = preview?.ticket;
  const event = preview?.event;
  const fees = preview?.fees;
  const seller = preview?.seller;
  const sellerStats = preview?.sellerStats;
  const sellerRatings = preview?.sellerRatings || [];

  const eventDateLabel = useMemo(() => formatDateTime(event?.starts_at), [event?.starts_at]);

  useEffect(() => {
    let cancelled = false;

    async function loadPreview() {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch('/api/checkout/preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ticketId }),
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          throw new Error(data?.error || 'No pudimos cargar el checkout');
        }

        if (!cancelled) setPreview(data);
      } catch (e) {
        if (!cancelled) setError(e.message || 'Error interno');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    if (ticketId) loadPreview();

    return () => {
      cancelled = true;
    };
  }, [ticketId]);

  async function startWebpayPayment() {
    setPaying(true);
    setError(null);

    try {
      const { data: sessionRes } = await supabase.auth.getSession();
      const token = sessionRes?.session?.access_token;
      const buyerId = sessionRes?.session?.user?.id;

      if (!token || !buyerId) {
        throw new Error('Debes iniciar sesión para comprar.');
      }

      const res = await fetch('/api/payments/webpay/create-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ ticketId, buyerId }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.error || 'No pudimos iniciar el pago');
      }

      const { url, token: tokenWs } = data;
      if (!url || !tokenWs) {
        throw new Error('Respuesta inválida de Webpay');
      }

      // Webpay Plus espera un POST con token_ws al URL entregado.
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = url;

      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = 'token_ws';
      input.value = tokenWs;

      form.appendChild(input);
      document.body.appendChild(form);
      form.submit();
    } catch (e) {
      setError(e.message || 'Error interno');
      setPaying(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10">
        <h1 className="text-3xl font-bold mb-2">Checkout</h1>
        <p className="text-gray-600">Cargando resumen…</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <h1 className="text-4xl font-bold mb-2">Checkout</h1>
      <p className="text-gray-600 mb-6">Revisa el resumen y elige tu medio de pago.</p>

      <button onClick={() => router.back()} className="text-blue-600 hover:underline mb-6">
        Volver
      </button>

      {error && (
        <div className="border border-red-200 bg-red-50 text-red-700 rounded-lg p-4 mb-6">
          {error}
        </div>
      )}

      {!preview ? (
        <div className="border rounded-lg p-6 text-gray-600">No hay información para mostrar.</div>
      ) : (
        <div className="space-y-6">
          {/* Evento */}
          <div className="border rounded-xl p-6">
            <div className="flex gap-4 items-start">
              {event?.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={event.image_url}
                  alt={event?.title || 'Evento'}
                  className="w-24 h-24 rounded-lg object-cover flex-shrink-0"
                />
              ) : null}

              <div className="flex-1">
                <div className="text-xl font-semibold">{event?.title || 'Evento'}</div>
                {eventDateLabel ? (
                  <div className="text-gray-600 mt-1">{eventDateLabel}</div>
                ) : null}
                <div className="text-gray-600 mt-1">
                  {[event?.venue, event?.city].filter(Boolean).join(', ')}
                </div>
              </div>
            </div>
          </div>

          {/* Ticket */}
          <div className="border rounded-xl p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-lg font-semibold">Tu entrada</div>
                <div className="text-gray-700 mt-2 space-y-1">
                  {ticket?.section ? <div>Sección: <b>{ticket.section}</b></div> : null}
                  {ticket?.row ? <div>Fila: <b>{ticket.row}</b></div> : null}
                  {ticket?.seat ? <div>Asiento: <b>{ticket.seat}</b></div> : null}
                  {ticket?.original_price ? (
                    <div className="text-gray-600">Precio original: <b>{formatPrice(ticket.original_price)}</b></div>
                  ) : null}
                  {ticket?.notes ? (
                    <div className="text-gray-600 mt-2">
                      <span className="font-medium">Notas:</span> {ticket.notes}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="text-right">
                <div className="text-sm text-gray-500">Precio</div>
                <div className="text-2xl font-bold">{formatPrice(ticket?.price)}</div>
              </div>
            </div>
          </div>

          {/* Vendedor */}
          <div className="border rounded-xl p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-lg font-semibold">Vendedor</div>
                <div className="text-gray-700 mt-2">
                  {seller?.full_name || seller?.email || 'Usuario'}
                </div>

                <div className="text-gray-600 mt-1">
                  {sellerStats?.totalRatings ? (
                    <>
                      ⭐ {sellerStats.averageStars} · {sellerStats.totalRatings}{' '}
                      {sellerStats.totalRatings === 1 ? 'comentario' : 'comentarios'}
                    </>
                  ) : (
                    'Aún sin comentarios'
                  )}
                </div>
              </div>

              {sellerRatings.length > 0 ? (
                <button
                  onClick={() => setShowSellerComments((v) => !v)}
                  className="text-blue-600 hover:underline"
                >
                  {showSellerComments ? 'Ocultar comentarios' : 'Ver comentarios'}
                </button>
              ) : null}
            </div>

            {showSellerComments ? (
              <div className="mt-4 space-y-3">
                {sellerRatings.map((r) => (
                  <div key={r.id} className="border rounded-lg p-3">
                    <div className="text-sm text-gray-600">
                      <b>{r.rater?.full_name || 'Usuario'}</b> · ⭐ {r.stars}
                    </div>
                    {r.comment ? <div className="mt-1">{r.comment}</div> : null}
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          {/* Microcopy de confianza */}
          <div className="rounded-xl border-2 border-blue-100 bg-blue-50 p-5">
            <div className="flex items-start gap-3">
              <span className="text-2xl">🔒</span>
              <div className="flex-1">
                <div className="font-semibold text-blue-900 mb-1">
                  Compra protegida
                </div>
                <div className="text-sm text-blue-800">
                  Tu pago queda en resguardo hasta que valides el acceso. Si hay problema,
                  puedes abrir disputa con evidencia. Soporte incluido.
                </div>
              </div>
            </div>
          </div>

          {/* Resumen */}
          <div className="border rounded-xl p-6">
            <div className="text-lg font-semibold mb-4">Resumen</div>

            <div className="space-y-2 text-gray-700">
              <div className="flex justify-between">
                <span>Entrada</span>
                <span>{formatPrice(fees?.ticketPrice ?? ticket?.price)}</span>
              </div>
              <div className="flex justify-between">
                <span>Cargo TixSwap</span>
                <span>{formatPrice(fees?.platformFee ?? 0)}</span>
              </div>
              <div className="border-t pt-3 flex justify-between text-lg font-semibold">
                <span>Total a pagar</span>
                <span>{formatPrice(fees?.totalDue ?? 0)}</span>
              </div>
            </div>

            <div className="mt-6">
              <div className="text-sm text-gray-600 mb-2">Medio de pago</div>
              <div className="border rounded-lg p-4 flex items-center justify-between">
                <div>
                  <div className="font-medium">Webpay</div>
                  <div className="text-sm text-gray-600">Tarjetas de débito y crédito</div>
                </div>

                <button
                  onClick={startWebpayPayment}
                  disabled={paying}
                  className="bg-blue-600 text-white px-5 py-2 rounded-lg disabled:opacity-60"
                >
                  {paying ? 'Iniciando…' : 'Pagar con Webpay'}
                </button>
              </div>
            </div>
          </div>

          <div className="text-xs text-gray-500">
            Al pagar, se reservará la entrada por unos minutos mientras finalizas el proceso.
          </div>
        </div>
      )}
    </div>
  );
}






