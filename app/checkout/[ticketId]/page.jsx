"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

export default function CheckoutTicketPage() {
  const router = useRouter();
  const { ticketId } = useParams();

  const formRef = useRef(null);

  const [user, setUser] = useState(null);
  const [preview, setPreview] = useState(null);

  const [loading, setLoading] = useState(true);
  const [creatingPayment, setCreatingPayment] = useState(false);
  const [error, setError] = useState("");

  const [webpayForm, setWebpayForm] = useState(null); // { url, token }

  // 1) Cargar sesión
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { data, error } = await supabase.auth.getSession();

      if (cancelled) return;

      if (error) {
        setError("No se pudo obtener tu sesión. Intenta nuevamente.");
        setLoading(false);
        return;
      }

      const session = data?.session;
      if (!session?.user) {
        // Si no hay sesión, mandamos a login
        router.replace(`/login?redirect=${encodeURIComponent(`/checkout/${ticketId}`)}`);
        return;
      }

      setUser(session.user);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [router, ticketId]);

  // 2) Cargar preview del ticket (monto + fee)
  useEffect(() => {
    if (!user || !ticketId) return;

    let cancelled = false;

    (async () => {
      setError("");

      const { data } = await supabase.auth.getSession();
      const accessToken = data?.session?.access_token;

      if (!accessToken) return;

      const res = await fetch(`/api/payments/webpay/preview?ticketId=${ticketId}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const json = await res.json();

      if (cancelled) return;

      if (!res.ok) {
        setError(json?.error || "No se pudo calcular el total.");
        return;
      }

      setPreview(json);
    })();

    return () => {
      cancelled = true;
    };
  }, [user, ticketId]);

  // 3) Crear sesión Webpay y redirigir (POST form token_ws)
  const handlePayWithWebpay = async () => {
    try {
      setCreatingPayment(true);
      setError("");

      const { data } = await supabase.auth.getSession();
      const accessToken = data?.session?.access_token;

      if (!accessToken) {
        router.replace(`/login?redirect=${encodeURIComponent(`/checkout/${ticketId}`)}`);
        return;
      }

      const res = await fetch("/api/payments/webpay/create-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ ticketId }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json?.error || "No se pudo iniciar el pago con Webpay.");
      }

      // Webpay exige POST con token_ws hacia json.url
      setWebpayForm({ url: json.url, token: json.token });
    } catch (e) {
      setError(e.message || "Error iniciando pago con Webpay.");
    } finally {
      setCreatingPayment(false);
    }
  };

  // 4) Auto submit al tener url+token
  useEffect(() => {
    if (webpayForm?.url && webpayForm?.token && formRef.current) {
      formRef.current.submit();
    }
  }, [webpayForm]);

  if (loading) {
    return (
      <div className="max-w-xl mx-auto p-6">
        <h1 className="text-xl font-bold">Cargando checkout...</h1>
      </div>
    );
  }

  if (webpayForm) {
    return (
      <div className="max-w-xl mx-auto p-6">
        <h1 className="text-xl font-bold mb-3">Redirigiendo a Webpay...</h1>
        <p className="text-sm text-gray-500 mb-4">
          Si no te redirige automáticamente, haz clic en el botón.
        </p>

        <form ref={formRef} method="POST" action={webpayForm.url}>
          <input type="hidden" name="token_ws" value={webpayForm.token} />
          <button className="tix-btn" type="submit">
            Ir a pagar con Webpay
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Checkout</h1>

      {error && (
        <div className="bg-red-100 text-red-700 p-3 rounded mb-4">
          {error}
        </div>
      )}

      {!preview ? (
        <p className="text-gray-500">Cargando resumen del pago...</p>
      ) : (
        <div className="border rounded p-4 mb-5">
          <p className="font-semibold mb-2">
            Evento: {preview.ticket?.events?.name || "—"}
          </p>

          <div className="flex justify-between">
            <span>Precio ticket</span>
            <span>${Number(preview.ticket?.price_clp || 0).toLocaleString("es-CL")}</span>
          </div>

          <div className="flex justify-between">
            <span>Fee comprador</span>
            <span>${Number(preview.buyerFee || 0).toLocaleString("es-CL")}</span>
          </div>

          <hr className="my-3" />

          <div className="flex justify-between font-bold text-lg">
            <span>Total</span>
            <span>${Number(preview.total || 0).toLocaleString("es-CL")}</span>
          </div>

          <p className="text-xs text-gray-500 mt-2">
            Fee aplicado: {(preview.fee_rate_applied * 100).toFixed(1)}%
          </p>
        </div>
      )}

      <button
        className="tix-btn w-full"
        onClick={handlePayWithWebpay}
        disabled={!preview || creatingPayment}
      >
        {creatingPayment ? "Iniciando pago..." : "Pagar con Webpay"}
      </button>
    </div>
  );
}
