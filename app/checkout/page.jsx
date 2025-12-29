"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { formatCLP } from "@/lib/fees";

export default function CheckoutPage() {
  const router = useRouter();
  const sp = useSearchParams();

  const ticketId = useMemo(() => sp.get("ticket") || "", [sp]);

  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [preview, setPreview] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    async function boot() {
      setErr("");

      if (!ticketId) {
        setErr("Falta ticket.");
        setLoading(false);
        return;
      }

      // Debe estar logueado para pagar
      const { data: userRes } = await supabase.auth.getUser();
      const user = userRes?.user;

      if (!user) {
        const redirectTo = `/checkout?ticket=${encodeURIComponent(ticketId)}`;
        router.replace(`/login?redirectTo=${encodeURIComponent(redirectTo)}`);
        return;
      }

      setLoading(true);

      try {
        const res = await fetch(`/api/checkout/preview?ticketId=${encodeURIComponent(ticketId)}`, {
          method: "GET",
        });

        const json = await res.json().catch(() => ({}));

        if (!res.ok) {
          throw new Error(json?.error || "No se pudo cargar el resumen.");
        }

        setPreview(json);
      } catch (e) {
        setErr(e?.message || "Error cargando checkout.");
      } finally {
        setLoading(false);
      }
    }

    boot();
  }, [ticketId, router]);

  async function handlePay() {
    setErr("");
    setCreating(true);

    try {
      const res = await fetch("/api/payments/banchile/create-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticketId }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(json?.error || "No se pudo iniciar el pago.");
      }

      if (!json?.processUrl) {
        throw new Error("Banchile no devolvió processUrl.");
      }

      window.location.href = json.processUrl;
    } catch (e) {
      setErr(e?.message || "Error iniciando pago.");
      setCreating(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/2" />
          <div className="h-24 bg-gray-200 rounded" />
          <div className="h-12 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  if (err) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10">
        <div className="rounded-2xl border bg-white p-6">
          <h1 className="text-2xl font-extrabold text-gray-900">Checkout</h1>
          <p className="mt-3 text-red-600">{err}</p>
          <button
            onClick={() => router.back()}
            className="mt-6 rounded-xl border px-4 py-2 font-semibold hover:bg-gray-50"
          >
            Volver
          </button>
        </div>
      </div>
    );
  }

  const ticket = preview?.ticket;
  const event = preview?.event;
  const fees = preview?.fees;

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <div className="rounded-2xl border bg-white p-6">
        <h1 className="text-2xl font-extrabold text-gray-900">Confirmar compra</h1>

        <div className="mt-4 space-y-2 text-gray-700">
          <div className="font-bold text-gray-900">{event?.title || "Evento"}</div>
          <div className="text-sm">
            {event?.starts_at
              ? new Date(event.starts_at).toLocaleString("es-CL", {
                  weekday: "short",
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "Fecha por confirmar"}
          </div>

          <div className="text-sm">
            {ticket?.sector ? `Sector: ${ticket.sector}` : ""}
            {ticket?.row ? ` · Fila: ${ticket.row}` : ""}
            {ticket?.seat ? ` · Asiento: ${ticket.seat}` : ""}
          </div>
        </div>

        <div className="mt-6 rounded-2xl bg-gray-50 p-4">
          <div className="flex items-center justify-between">
            <span>Precio entrada</span>
            <span className="font-bold">{formatCLP(fees?.basePrice)}</span>
          </div>

          <div className="mt-2 flex items-center justify-between text-sm text-gray-700">
            <span>Comisión comprador</span>
            <span>{formatCLP(fees?.buyerFee)}</span>
          </div>

          <div className="mt-3 border-t pt-3 flex items-center justify-between">
            <span className="font-bold">Total a pagar</span>
            <span className="font-extrabold text-green-700">{formatCLP(fees?.totalToPay)}</span>
          </div>

          <div className="mt-3 text-xs text-gray-600">
            * El PDF se libera automáticamente cuando el pago quede <b>aprobado</b>.
          </div>
        </div>

        <div className="mt-6 flex gap-3">
          <button
            onClick={() => router.back()}
            className="rounded-xl border px-4 py-2 font-semibold hover:bg-gray-50"
            disabled={creating}
          >
            Volver
          </button>

          <button
            onClick={handlePay}
            className="rounded-xl bg-blue-600 text-white px-5 py-2 font-bold hover:bg-blue-700 disabled:opacity-60"
            disabled={creating}
          >
            {creating ? "Abriendo pago..." : "Pagar con Banchile"}
          </button>
        </div>

        <div className="mt-4 text-xs text-gray-500">
          Ticket: <span className="font-mono">{ticketId}</span>
        </div>
      </div>
    </div>
  );
}
