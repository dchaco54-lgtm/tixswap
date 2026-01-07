"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

function clp(n) {
  const val = Number(n || 0);
  return val.toLocaleString("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  });
}

export default function CheckoutPage({ params }) {
  const ticketId = params?.ticketId;

  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState(null);

  const totals = useMemo(() => {
    if (!preview) return null;
    return {
      ticketPrice: preview?.pricing?.ticketPrice ?? preview?.ticket?.price ?? 0,
      serviceFee: preview?.pricing?.serviceFee ?? 0,
      total: preview?.pricing?.total ?? 0,
    };
  }, [preview]);

  async function getAccessToken() {
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token || null;
  }

  async function loadPreview() {
    setLoading(true);
    setError("");

    try {
      const token = await getAccessToken();
      if (!token) {
        setError("Debes iniciar sesión para continuar.");
        setPreview(null);
        return;
      }

      const res = await fetch(`/api/checkout/preview?ticketId=${ticketId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json?.error || "Error al obtener resumen");
        setPreview(null);
        return;
      }

      setPreview(json);
    } catch (e) {
      setError(e?.message || "Error inesperado al cargar el checkout");
      setPreview(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!ticketId) return;
    loadPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketId]);

  async function startWebpay() {
    setPaying(true);
    setError("");

    try {
      const token = await getAccessToken();
      if (!token) {
        setError("Debes iniciar sesión para pagar.");
        return;
      }

      const res = await fetch("/api/payments/webpay/create-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ ticketId }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json?.error || "No se pudo iniciar Webpay");
        return;
      }

      const redirect = `${json.url}?token_ws=${json.token}`;
      window.location.href = redirect;
    } catch (e) {
      setError(e?.message || "Error inesperado iniciando Webpay");
    } finally {
      setPaying(false);
    }
  }

  async function startBanchile() {
    setPaying(true);
    setError("");

    try {
      const token = await getAccessToken();
      if (!token) {
        setError("Debes iniciar sesión para pagar.");
        return;
      }

      const res = await fetch("/api/payments/banchile/create-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ ticketId }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          json?.error ||
            "No se pudo iniciar Banco de Chile (posible falta de credenciales)",
        );
        return;
      }

      if (!json?.processUrl) {
        setError("Banco de Chile no devolvió URL de pago.");
        return;
      }

      window.location.href = json.processUrl;
    } catch (e) {
      setError(e?.message || "Error inesperado iniciando Banco de Chile");
    } finally {
      setPaying(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold">Checkout</h1>
          <p className="text-gray-600 mt-1">
            Revisa el resumen y elige tu medio de pago.
          </p>
        </div>
        <button
          className="text-blue-600 hover:underline"
          onClick={() => window.history.back()}
        >
          Volver
        </button>
      </div>

      {error && (
        <div className="mb-6 border border-red-200 bg-red-50 text-red-700 rounded-xl p-4">
          {error}
        </div>
      )}

      <div className="border rounded-2xl p-6 bg-white shadow-sm">
        {loading ? (
          <div className="text-gray-600">Cargando resumen del pago...</div>
        ) : !preview ? (
          <div className="text-gray-600">
            No se pudo cargar el resumen. Intenta nuevamente.
          </div>
        ) : (
          <>
            <div className="mb-5">
              <div className="text-sm text-gray-500">Evento</div>
              <div className="text-lg font-semibold">
                {preview?.ticket?.event?.name || "Evento"}
              </div>
              <div className="text-gray-600">
                {(preview?.ticket?.event?.city || "Santiago") +
                  (preview?.ticket?.event?.venue
                    ? ` · ${preview.ticket.event.venue}`
                    : "")}
              </div>
            </div>

            <div className="border-t pt-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-700">Entrada</span>
                <span className="font-medium">{clp(totals.ticketPrice)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-700">Comisión TixSwap</span>
                <span className="font-medium">{clp(totals.serviceFee)}</span>
              </div>
              <div className="flex justify-between pt-2 border-t">
                <span className="text-gray-900 font-semibold">Total</span>
                <span className="text-gray-900 font-semibold">
                  {clp(totals.total)}
                </span>
              </div>
            </div>

            <div className="mt-7">
              <div className="text-sm text-gray-500 mb-3">Medio de pago</div>

              <div className="grid md:grid-cols-3 gap-3">
                <button
                  onClick={startWebpay}
                  disabled={paying}
                  className="rounded-xl border p-4 text-left hover:shadow-sm transition disabled:opacity-60"
                >
                  <div className="font-semibold">Webpay</div>
                  <div className="text-sm text-gray-600">
                    Tarjeta débito/crédito
                  </div>
                </button>

                <button
                  onClick={startBanchile}
                  disabled={paying}
                  className="rounded-xl border p-4 text-left hover:shadow-sm transition disabled:opacity-60"
                >
                  <div className="font-semibold">Banco de Chile</div>
                  <div className="text-sm text-gray-600">
                    Pago con Banchile/Chile
                  </div>
                </button>

                <button
                  disabled
                  className="rounded-xl border p-4 text-left opacity-60 cursor-not-allowed"
                  title="Pronto"
                >
                  <div className="font-semibold">Mercado Pago</div>
                  <div className="text-sm text-gray-600">Pronto</div>
                </button>
              </div>

              {paying && (
                <div className="mt-4 text-gray-600">
                  Iniciando pago... no cierres esta ventana.
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

