"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

function redirectPost(url, fields = {}) {
  // Webpay (Transbank) espera token_ws vía POST (form submit).
  const form = document.createElement("form");
  form.method = "POST";
  form.action = url;

  Object.entries(fields).forEach(([k, v]) => {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = k;
    input.value = String(v ?? "");
    form.appendChild(input);
  });

  document.body.appendChild(form);
  form.submit();
}

export default function CheckoutPage() {
  const { ticketId } = useParams();
  const router = useRouter();

  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState("");

  const webpayEnabled = useMemo(
    () => (preview?.providers?.webpay?.enabled ?? true),
    [preview]
  );

  const banchileEnabled = useMemo(
    () => (preview?.providers?.banchile?.enabled ?? false),
    [preview]
  );

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setError("");

      try {
        const res = await fetch(`/api/payments/webpay/preview?ticketId=${ticketId}`);
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data?.error || "Error al obtener resumen");
        }
        const data = await res.json();
        if (mounted) setPreview(data);
      } catch (e) {
        if (mounted) setError(e.message || "Error al obtener resumen");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    if (ticketId) load();
    return () => {
      mounted = false;
    };
  }, [ticketId]);

  async function getAccessToken() {
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token || null;
  }

  async function payWithWebpay() {
    setError("");
    if (!webpayEnabled) {
      setError("Webpay está en activación (faltan credenciales en producción).");
      return;
    }

    setPaying(true);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Debes iniciar sesión para pagar.");

      const res = await fetch("/api/payments/webpay/create-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ ticketId }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "No se pudo iniciar Webpay");

      // ✅ Webpay debe recibir token_ws por POST
      redirectPost(data.url, { token_ws: data.token });
    } catch (e) {
      setError(e.message || "Error iniciando Webpay");
      setPaying(false);
    }
  }

  async function payWithBancoChile() {
    setError("");
    if (!banchileEnabled) {
      setError("Banco de Chile está en activación (faltan credenciales API).");
      return;
    }

    setPaying(true);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Debes iniciar sesión para pagar.");

      const res = await fetch("/api/payments/banchile/create-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ ticketId }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "No se pudo iniciar Banco de Chile");

      // Banco de Chile típicamente redirige por URL normal
      window.location.href = data.processUrl;
    } catch (e) {
      setError(e.message || "Error iniciando Banco de Chile");
      setPaying(false);
    }
  }

  return (
    <div className="min-h-[70vh] flex items-start justify-center bg-[#f7f8fb]">
      <div className="w-full max-w-3xl px-4 py-10">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Checkout</h1>
            <p className="text-gray-600 mt-1">
              Revisa el resumen y elige tu medio de pago.
            </p>
          </div>

          <button
            className="text-blue-600 hover:underline mt-2"
            onClick={() => router.back()}
          >
            Volver
          </button>
        </div>

        <div className="mt-6 bg-white rounded-2xl shadow-sm border p-6">
          {loading ? (
            <div className="text-gray-600">Cargando resumen del pago...</div>
          ) : error ? (
            <div className="text-red-600 font-medium">{error}</div>
          ) : (
            <>
              <div className="grid gap-2">
                <div className="text-lg font-semibold text-gray-900">
                  {preview?.event?.name || "Evento"}
                </div>
                <div className="text-gray-600">
                  {preview?.event?.city ? `${preview.event.city} · ` : ""}
                  {preview?.event?.venue || ""}
                </div>
              </div>

              <div className="mt-6 border-t pt-5 grid gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-gray-700">Entrada</span>
                  <span className="font-medium">
                    ${Number(preview?.ticket?.price || 0).toLocaleString("es-CL")}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-gray-700">Comisión TixSwap</span>
                  <span className="font-medium">
                    ${Number(preview?.buyerFee || 0).toLocaleString("es-CL")}
                  </span>
                </div>

                <div className="flex items-center justify-between border-t pt-3">
                  <span className="text-gray-900 font-semibold">Total</span>
                  <span className="text-gray-900 font-bold text-lg">
                    ${Number(preview?.total || 0).toLocaleString("es-CL")}
                  </span>
                </div>
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <button
                  className={`rounded-xl px-4 py-3 font-semibold transition ${
                    webpayEnabled && !paying
                      ? "bg-blue-600 text-white hover:bg-blue-700"
                      : "bg-gray-200 text-gray-500 cursor-not-allowed"
                  }`}
                  onClick={payWithWebpay}
                  disabled={!webpayEnabled || paying}
                >
                  {webpayEnabled ? "Pagar con Webpay" : "Webpay (en activación)"}
                </button>

                <button
                  className={`rounded-xl px-4 py-3 font-semibold transition ${
                    banchileEnabled && !paying
                      ? "bg-emerald-600 text-white hover:bg-emerald-700"
                      : "bg-gray-200 text-gray-500 cursor-not-allowed"
                  }`}
                  onClick={payWithBancoChile}
                  disabled={!banchileEnabled || paying}
                >
                  {banchileEnabled ? "Pagar con Banco de Chile" : "Banco de Chile (en activación)"}
                </button>
              </div>

              <div className="mt-4 text-xs text-gray-500">
                Mercado Pago: pronto.
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

