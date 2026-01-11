// app/checkout/[ticketId]/page.jsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";

function formatCLP(value) {
  const n = Number(value ?? 0);
  return n.toLocaleString("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  });
}

function BluePayButton({ title, subtitle, disabled, onClick }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={[
        "w-full text-left rounded-lg border px-5 py-4 transition",
        disabled
          ? "bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed"
          : "bg-blue-600 border-blue-700 text-white hover:bg-blue-700",
      ].join(" ")}
    >
      <div className="font-semibold">{title}</div>
      <div className={disabled ? "text-gray-400 text-sm" : "text-blue-100 text-sm"}>
        {subtitle}
      </div>
    </button>
  );
}

export default function CheckoutPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();

  const ticketId = params?.ticketId;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [preview, setPreview] = useState(null);

  // Si volvemos del “pago simulado”, manda a Mis Compras sí o sí (success o fail)
  useEffect(() => {
    const payment = searchParams.get("payment"); // success | failed
    const provider = searchParams.get("provider");
    if (payment && provider) {
      router.replace("/dashboard/purchases");
    }
  }, [router, searchParams]);

  useEffect(() => {
    if (!ticketId) return;

    let cancelled = false;

    async function loadPreview() {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch("/api/checkout/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ticketId }),
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data?.error || "No se pudo cargar el resumen.");
        }

        if (!cancelled) setPreview(data);
      } catch (e) {
        console.error("Checkout preview error:", e);
        if (!cancelled) setError("Error al obtener resumen");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadPreview();
    return () => {
      cancelled = true;
    };
  }, [ticketId]);

  const price = useMemo(() => Number(preview?.ticket?.price ?? 0), [preview]);
  const fee = useMemo(() => Math.round(price * 0.025), [price]);
  const total = useMemo(() => price + fee, [price, fee]);

  async function startPayment(provider) {
    try {
      setError(null);

      const endpoint =
        provider === "webpay"
          ? "/api/payments/webpay/create-session"
          : provider === "banchile"
            ? "/api/payments/banchile/create-session"
            : "/api/payments/mercadopago/create-session";

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticketId,
          amount: total,
          // el retorno lo maneja /pago-simulado/[provider]
          returnUrl: `/checkout/${ticketId}`,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "No se pudo iniciar el pago.");

      if (data?.processUrl) {
        window.location.href = data.processUrl;
        return;
      }

      throw new Error("No recibimos URL de pago.");
    } catch (e) {
      console.error("startPayment error:", e);
      setError(e.message || "No se pudo iniciar el pago.");
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold">Checkout</h1>
            <p className="text-gray-600">Revisa el resumen y elige tu medio de pago.</p>
          </div>
          <button
            onClick={() => router.back()}
            className="text-blue-600 hover:underline"
          >
            Volver
          </button>
        </div>

        {loading ? (
          <div className="bg-white rounded-lg shadow-sm p-6">
            Cargando resumen del pago...
          </div>
        ) : error ? (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="bg-red-50 text-red-700 border border-red-200 rounded-md px-4 py-3 font-medium">
              {error}
            </div>
            <div className="text-gray-600 mt-3">No hay información para mostrar.</div>
          </div>
        ) : (
          <>
            <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
              <div className="text-sm text-gray-500">Evento</div>
              <div className="text-xl font-semibold">{preview?.event?.name || "Evento"}</div>
              <div className="text-gray-600">
                {(preview?.event?.city || "Santiago") +
                  (preview?.event?.venue ? ` • ${preview.event.venue}` : "")}
              </div>

              <div className="border-t my-5" />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-gray-500">Entrada</div>
                  <div className="font-medium">
                    {preview?.ticket?.section || preview?.ticket?.row || preview?.ticket?.seat
                      ? `${preview?.ticket?.section || "-"} / ${preview?.ticket?.row || "-"} / ${preview?.ticket?.seat || "-"}`
                      : "Sin ubicación"}
                  </div>
                </div>
                <div>
                  <div className="text-gray-500">Vendedor</div>
<div className="font-medium">
  {preview?.seller?.name || preview?.seller?.email || "Vendedor"}
  {preview?.seller?.rating != null && (
    <span className="ml-2 text-gray-500">
      ★ {preview.seller.rating} ({preview.seller.ratingCount || 0})
    </span>
  )}
</div>
                </div>
              </div>

              <div className="border-t my-5" />

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Entrada</span>
                  <span className="font-medium">{formatCLP(price)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Comisión TixSwap (2,5%)</span>
                  <span className="font-medium">{formatCLP(fee)}</span>
                </div>
                <div className="flex justify-between text-base pt-2 border-t">
                  <span className="font-semibold">Total</span>
                  <span className="font-semibold">{formatCLP(total)}</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="text-sm font-semibold text-gray-700 mb-3">Medio de pago</div>

              <div className="grid grid-cols-1 gap-3">
                <BluePayButton
                  title="Webpay"
                  subtitle="Tarjeta débito/crédito"
                  onClick={() => startPayment("webpay")}
                />
                <BluePayButton
                  title="Banco de Chile"
                  subtitle="Pago con Banchile/Chile"
                  onClick={() => startPayment("banchile")}
                />
                <BluePayButton
                  title="Mercado Pago"
                  subtitle="Pronto"
                  disabled
                  onClick={() => {}}
                />
              </div>

              <div className="text-xs text-gray-500 mt-4">
                * Por ahora el flujo está en modo “simulado” hasta que lleguen las credenciales reales (Webpay / Banco de Chile).
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}


