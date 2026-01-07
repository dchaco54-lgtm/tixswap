"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { formatCLP } from "@/lib/format";
import { supabase } from "@/lib/supabaseClient";

function buildSeatLabel(ticket) {
  const sector = ticket?.sector ?? "-";
  const row = ticket?.row ?? "-";
  const seat = ticket?.seat ?? "-";
  return `${sector} / ${row} / ${seat}`;
}

export default function CheckoutPage() {
  const router = useRouter();
  const { ticketId } = useParams();

  const [loading, setLoading] = useState(true);
  const [previewLoading, setPreviewLoading] = useState(true);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState("");
  const [paying, setPaying] = useState(false);

  const [webpayForm, setWebpayForm] = useState(null); // { url, token }

  const seatLabel = useMemo(() => buildSeatLabel(preview?.ticket), [preview]);

  // 1) Validar sesión
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.auth.getSession();
      const session = data?.session;

      if (error || !session?.user) {
        router.replace(`/login?redirectTo=${encodeURIComponent(`/checkout/${ticketId}`)}`);
        return;
      }

      setLoading(false);
    })();
  }, [router, ticketId]);

  // 2) Cargar resumen del checkout
  useEffect(() => {
    if (!ticketId) return;

    (async () => {
      try {
        setPreviewLoading(true);
        setError("");

        const res = await fetch(`/api/checkout/preview?ticketId=${ticketId}`, {
          method: "GET",
          cache: "no-store",
        });

        const json = await res.json().catch(() => ({}));

        if (!res.ok) {
          throw new Error(json?.error || "No se pudo cargar el resumen.");
        }

        setPreview(json);
      } catch (e) {
        setError(e?.message || "Error al obtener resumen.");
      } finally {
        setPreviewLoading(false);
      }
    })();
  }, [ticketId]);

  // Helpers: token supabase para llamadas POST a create-session
  async function getAccessTokenOrRedirect() {
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token;

    if (!token) {
      router.replace(`/login?redirectTo=${encodeURIComponent(`/checkout/${ticketId}`)}`);
      return null;
    }
    return token;
  }

  async function payWebpay() {
    try {
      setPaying(true);
      setError("");

      const token = await getAccessTokenOrRedirect();
      if (!token) return;

      const res = await fetch("/api/payments/webpay/create-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ ticketId }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "No se pudo iniciar pago con Webpay.");

      setWebpayForm({ url: json.url, token: json.token });
    } catch (e) {
      setError(e?.message || "Error iniciando Webpay.");
    } finally {
      setPaying(false);
    }
  }

  async function payBanchile() {
    try {
      setPaying(true);
      setError("");

      const token = await getAccessTokenOrRedirect();
      if (!token) return;

      const origin = window.location.origin;
      const returnUrl = `${origin}/payment/banchile/result`;

      const res = await fetch("/api/payments/banchile/create-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ ticketId, returnUrl }),
      });

      const json = await res.json().catch(() => ({}));

      if (res.status === 501) {
        throw new Error("Banco de Chile aún sin credenciales. Queda listo apenas las tengas.");
      }

      if (!res.ok) throw new Error(json?.error || "No se pudo iniciar pago con Banco de Chile.");

      if (json.processUrl) {
        window.location.href = json.processUrl;
      } else {
        throw new Error("No se recibió processUrl desde Banco de Chile.");
      }
    } catch (e) {
      setError(e?.message || "Error iniciando Banco de Chile.");
    } finally {
      setPaying(false);
    }
  }

  // Auto-POST a Webpay cuando se recibe url+token
  useEffect(() => {
    if (!webpayForm?.url || !webpayForm?.token) return;

    const form = document.createElement("form");
    form.method = "POST";
    form.action = webpayForm.url;

    const input = document.createElement("input");
    input.type = "hidden";
    input.name = "token_ws";
    input.value = webpayForm.token;

    form.appendChild(input);
    document.body.appendChild(form);
    form.submit();
  }, [webpayForm]);

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <h1 className="text-xl font-bold">Cargando checkout...</h1>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Checkout</h1>
          <p className="text-gray-600">Revisa el resumen y elige tu medio de pago.</p>
        </div>

        <button className="tix-link" onClick={() => router.back()}>
          Volver
        </button>
      </div>

      {error && (
        <div className="bg-red-100 text-red-700 p-3 rounded mb-4">
          {error}
        </div>
      )}

      {previewLoading ? (
        <p className="text-gray-500">Cargando resumen...</p>
      ) : !preview ? (
        <p className="text-gray-500">No hay información para mostrar.</p>
      ) : (
        <div className="tix-card p-6">
          {/* Confirmación evento */}
          <div className="mb-5">
            <p className="text-sm text-gray-500">Evento</p>
            <p className="text-lg font-semibold">{preview.event?.title || "Evento"}</p>
            <p className="text-gray-600">
              {preview.event?.city || "—"} {preview.event?.venue ? `· ${preview.event.venue}` : ""}
            </p>
          </div>

          <hr className="my-5" />

          {/* Resumen compra */}
          <div className="grid gap-3">
            <div className="flex justify-between">
              <span className="text-gray-700">Ubicación</span>
              <span className="font-medium">{seatLabel}</span>
            </div>

            <div className="flex justify-between">
              <span className="text-gray-700">Vendedor</span>
              <span className="font-medium">{preview.seller?.displayName || "—"}</span>
            </div>

            <div className="flex justify-between">
              <span className="text-gray-700">Valor entrada</span>
              <span className="font-medium">{formatCLP(preview.ticketPrice)}</span>
            </div>

            <div className="flex justify-between">
              <span className="text-gray-700">
                Comisión TixSwap ({Math.round((preview.commissionPct || 0) * 1000) / 10}%)
              </span>
              <span className="font-medium">{formatCLP(preview.serviceFee)}</span>
            </div>

            <hr className="my-2" />

            <div className="flex justify-between text-lg font-bold">
              <span>Total</span>
              <span>{formatCLP(preview.total)}</span>
            </div>

            <p className="text-xs text-gray-500">
              * El total es el monto que se envía al medio de pago.
            </p>
          </div>

          <hr className="my-6" />

          {/* Medios de pago */}
          <div>
            <p className="font-semibold mb-3">Medio de pago</p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                className="tix-btn-primary w-full"
                onClick={payWebpay}
                disabled={paying}
              >
                Webpay
                <span className="block text-xs opacity-90 font-normal">
                  Tarjeta débito/crédito
                </span>
              </button>

              <button
                className="tix-btn-primary w-full"
                onClick={payBanchile}
                disabled={paying}
              >
                Banco de Chile
                <span className="block text-xs opacity-90 font-normal">
                  Pago con Banchile/Chile
                </span>
              </button>

              <button className="tix-btn-primary w-full opacity-50 cursor-not-allowed" disabled>
                Mercado Pago
                <span className="block text-xs opacity-90 font-normal">Pronto</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


