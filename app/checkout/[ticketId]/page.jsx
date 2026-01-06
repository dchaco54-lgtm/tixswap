"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function CheckoutPage() {
  const { ticketId } = useParams();
  const router = useRouter();

  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState("");

  const clp = useMemo(
    () =>
      new Intl.NumberFormat("es-CL", {
        style: "currency",
        currency: "CLP",
        maximumFractionDigits: 0,
      }),
    []
  );

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");

      try {
        const res = await fetch(
          `/api/payments/webpay/preview?ticketId=${encodeURIComponent(ticketId)}`
        );
        const data = await res.json().catch(() => ({}));

        if (!res.ok) throw new Error(data?.error || "No se pudo cargar el resumen.");
        if (!cancelled) setPreview(data);
      } catch (e) {
        if (!cancelled) setError(e?.message || "Error al cargar el resumen.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    if (ticketId) load();
    return () => {
      cancelled = true;
    };
  }, [ticketId]);

  async function payWithWebpay() {
    try {
      setPaying(true);
      setError("");

      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;

      const res = await fetch("/api/payments/webpay/create-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({ ticketId }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "No se pudo iniciar Webpay.");

      window.location.href = `${data.url}?token_ws=${data.token}`;
    } catch (e) {
      setError(e?.message || "Error iniciando Webpay.");
      setPaying(false);
    }
  }

  async function payWithBancoChile() {
    try {
      setPaying(true);
      setError("");

      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;

      const res = await fetch("/api/payments/banchile/create-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({ ticketId }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "No se pudo iniciar Banco de Chile.");

      window.location.href = data.processUrl;
    } catch (e) {
      setError(e?.message || "Error iniciando Banco de Chile.");
      setPaying(false);
    }
  }

  const price = preview?.fees?.price ?? Number(preview?.ticket?.price ?? 0);
  const buyerFee = preview?.fees?.buyerFee ?? 0;
  const total = preview?.fees?.total ?? 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-10">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Checkout</h1>
            <p className="text-gray-600 mt-1">Revisa el resumen y elige tu medio de pago.</p>
          </div>
          <button onClick={() => router.back()} className="text-blue-600 hover:underline">
            Volver
          </button>
        </div>

        <div className="bg-white border rounded-2xl p-6 shadow-sm">
          {loading ? (
            <p className="text-gray-600">Cargando resumen del pago…</p>
          ) : error ? (
            <div className="text-red-600">{error}</div>
          ) : (
            <>
              <div className="mb-5">
                <p className="text-sm text-gray-500">Evento</p>
                <p className="text-lg font-semibold text-gray-900">
                  {preview?.event?.name || preview?.event?.title || "Evento"}
                </p>
                <p className="text-sm text-gray-600">
                  {preview?.event?.city ? `${preview.event.city} · ` : ""}
                  {preview?.event?.venue || ""}
                </p>
              </div>

              <div className="border rounded-xl p-4 bg-gray-50">
                <div className="flex items-center justify-between">
                  <span>Entrada</span>
                  <span className="font-semibold">{clp.format(price)}</span>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span>Fee TixSwap</span>
                  <span className="font-semibold">{clp.format(buyerFee)}</span>
                </div>
                <div className="h-px bg-gray-200 my-3" />
                <div className="flex items-center justify-between">
                  <span className="font-semibold">Total</span>
                  <span className="font-bold">{clp.format(total)}</span>
                </div>
              </div>

              <div className="mt-6">
                <p className="text-sm font-semibold mb-3">Medio de pago</p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <button
                    onClick={payWithWebpay}
                    disabled={paying}
                    className="border rounded-xl p-4 text-left hover:border-blue-400 hover:bg-blue-50 transition disabled:opacity-60"
                  >
                    <div className="font-semibold">Webpay</div>
                    <div className="text-sm text-gray-600 mt-1">Tarjetas vía Transbank.</div>
                    <div className="mt-3">
                      <span className="inline-flex px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-semibold">
                        {paying ? "Iniciando…" : "Pagar con Webpay"}
                      </span>
                    </div>
                  </button>

                  <button
                    onClick={payWithBancoChile}
                    disabled={paying}
                    className="border rounded-xl p-4 text-left hover:border-green-500 hover:bg-green-50 transition disabled:opacity-60"
                  >
                    <div className="font-semibold">Banco de Chile</div>
                    <div className="text-sm text-gray-600 mt-1">Checkout Banchile Pagos.</div>
                    <div className="mt-3">
                      <span className="inline-flex px-3 py-1.5 rounded-lg bg-green-600 text-white text-sm font-semibold">
                        {paying ? "Iniciando…" : "Pagar con Banco de Chile"}
                      </span>
                    </div>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
