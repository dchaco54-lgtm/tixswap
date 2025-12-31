"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { formatCLP } from "@/lib/format";

export default function CheckoutPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const ticketId = useMemo(() => searchParams.get("ticket"), [searchParams]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [ticket, setTicket] = useState(null);
  const [event, setEvent] = useState(null);
  const [fees, setFees] = useState(null);

  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        setLoading(true);
        setError("");

        if (!ticketId) {
          if (!alive) return;
          setError("Falta ticket en la URL.");
          setLoading(false);
          return;
        }

        const { data: sessionData } = await supabase.auth.getSession();
        const session = sessionData?.session;

        if (!session) {
          if (!alive) return;
          setError("No autenticado.");
          setLoading(false);
          return;
        }

        const res = await fetch(`/api/checkout/preview?ticket=${encodeURIComponent(ticketId)}`, {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        const json = await res.json().catch(() => ({}));

        if (!res.ok) {
          if (!alive) return;
          setError(json.error || "No se pudo cargar el checkout.");
          setLoading(false);
          return;
        }

        if (!alive) return;

        setTicket(json.ticket || null);
        setEvent(json.event || json.ticket?.event || null);
        setFees(json.fees || null);
        setLoading(false);
      } catch (e) {
        if (!alive) return;
        setError("Error inesperado.");
        setLoading(false);
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, [ticketId]);

  const total = useMemo(() => {
    if (!ticket || !fees) return null;
    return fees.totalToPay;
  }, [ticket, fees]);

  const handleGoLogin = () => {
    const redirect = encodeURIComponent(`/checkout?ticket=${ticketId}`);
    router.push(`/login?redirectTo=${redirect}`);
  };

  const handleBack = () => {
    router.back();
  };

  const handlePay = async () => {
    try {
      setError("");

      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData?.session;

      if (!session) {
        setError("No autenticado.");
        return;
      }

      // Aquí va tu integración real (Webpay). Por ahora lo dejamos como placeholder.
      // Si ya tienes endpoint, deja la llamada tal cual y pásale ticketId.
      const res = await fetch("/api/checkout/pay", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ ticketId }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(json.error || "No se pudo iniciar el pago.");
        return;
      }

      if (json?.redirectUrl) {
        window.location.href = json.redirectUrl;
        return;
      }

      // fallback
      router.push("/dashboard");
    } catch (e) {
      setError("Error iniciando el pago.");
    }
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10">
        <div className="bg-white rounded-2xl shadow p-6">
          <h1 className="text-2xl font-bold">Checkout</h1>
          <p className="mt-2 text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10">
        <div className="bg-white rounded-2xl shadow p-6">
          <h1 className="text-2xl font-bold">Checkout</h1>
          <p className="mt-2 text-red-600">{error}</p>

          <div className="mt-6 flex gap-3">
            <button
              onClick={handleBack}
              className="px-4 py-2 rounded-xl border border-gray-200"
            >
              Volver
            </button>

            {error === "No autenticado." && (
              <button
                onClick={handleGoLogin}
                className="px-4 py-2 rounded-xl bg-blue-600 text-white"
              >
                Iniciar sesión
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (!ticket || !event) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10">
        <div className="bg-white rounded-2xl shadow p-6">
          <h1 className="text-2xl font-bold">Checkout</h1>
          <p className="mt-2 text-red-600">Ticket no encontrado.</p>
          <button
            onClick={handleBack}
            className="mt-6 px-4 py-2 rounded-xl border border-gray-200"
          >
            Volver
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <div className="bg-white rounded-2xl shadow p-6">
        <h1 className="text-2xl font-bold">Checkout</h1>

        <div className="mt-6 space-y-2">
          <div className="text-lg font-semibold">{event.name || event.title}</div>
          <div className="text-gray-600">
            {event.venue || event.location || "—"}
          </div>

          <div className="mt-4 border-t pt-4 space-y-2">
            <div className="flex justify-between">
              <span>Precio ticket</span>
              <span className="font-medium">{formatCLP(ticket.price)}</span>
            </div>

            {fees && (
              <>
                <div className="flex justify-between text-gray-700">
                  <span>Fee comprador</span>
                  <span className="font-medium">{formatCLP(fees.buyerFee)}</span>
                </div>

                <div className="flex justify-between text-gray-700">
                  <span>Total</span>
                  <span className="font-bold">{formatCLP(total)}</span>
                </div>
              </>
            )}
          </div>

          <div className="mt-6 flex gap-3">
            <button
              onClick={handleBack}
              className="px-4 py-2 rounded-xl border border-gray-200"
            >
              Volver
            </button>

            <button
              onClick={handlePay}
              className="px-4 py-2 rounded-xl bg-blue-600 text-white"
            >
              Pagar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
