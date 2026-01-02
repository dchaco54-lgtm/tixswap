"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../lib/supabaseClient";
import { formatCLP } from "../lib/format";

export default function CheckoutPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const ticketId = sp.get("ticket");

  const [loading, setLoading] = useState(true);
  const [ticket, setTicket] = useState(null);
  const [event, setEvent] = useState(null);
  const [error, setError] = useState("");

  const total = useMemo(() => {
    const price = Number(ticket?.price ?? 0);
    return Number.isFinite(price) ? price : 0;
  }, [ticket]);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setError("");

      try {
        const { data: sessionData } = await supabase.auth.getSession();
        if (!sessionData?.session) {
          setError("No autenticado.");
          setLoading(false);
          return;
        }

        if (!ticketId) {
          setError("Falta el ticket en la URL.");
          setLoading(false);
          return;
        }

        const res = await fetch(`/api/checkout/preview?ticket=${ticketId}`, {
  headers: {
    Authorization: `Bearer ${session.access_token}`,
  },
});
        const json = await res.json().catch(() => ({}));

        if (!res.ok) {
          setError(json?.error || "Error al cargar el checkout.");
          setLoading(false);
          return;
        }

        setTicket(json.ticket || null);
        setEvent(json.event || null);
        setLoading(false);
      } catch (e) {
        setError("Error inesperado al cargar el checkout.");
        setLoading(false);
      }
    };

    run();
  }, [ticketId]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-slate-600">Cargando checkout...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="w-full max-w-xl bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
          <h1 className="text-2xl font-bold text-slate-900">Checkout</h1>
          <p className="mt-2 text-red-600">{error}</p>
          <div className="mt-6">
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-4 py-2 text-slate-700 hover:bg-slate-50"
            >
              Volver
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
        <h1 className="text-2xl font-bold text-slate-900">Checkout</h1>

        <div className="mt-6 space-y-2">
          <div className="text-slate-700">
            <span className="font-semibold">Evento:</span> {event?.name || event?.title || "—"}
          </div>
          <div className="text-slate-700">
            <span className="font-semibold">Ticket:</span> {ticket?.id || "—"}
          </div>
          <div className="text-slate-700">
            <span className="font-semibold">Total:</span> {formatCLP(total)}
          </div>
        </div>

        <div className="mt-8 flex gap-3">
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-4 py-2 text-slate-700 hover:bg-slate-50"
          >
            Volver
          </Link>

          <button
            className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
            onClick={() => alert("Aquí va Webpay después 😉")}
          >
            Pagar
          </button>
        </div>
      </div>
    </div>
  );
}
