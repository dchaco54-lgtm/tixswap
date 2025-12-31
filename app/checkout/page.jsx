"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

function formatCLP(n) {
  const num = Number(n || 0);
  return num.toLocaleString("es-CL", { style: "currency", currency: "CLP" });
}

function isoToNice(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleString("es-CL", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function CheckoutPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const ticketId = searchParams.get("ticket");

  const [loading, setLoading] = useState(true);
  const [ticket, setTicket] = useState(null);
  const [error, setError] = useState("");

  const redirectTo = useMemo(() => {
    const url = `/checkout?ticket=${encodeURIComponent(ticketId || "")}`;
    return url;
  }, [ticketId]);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setError("");
      setTicket(null);

      if (!ticketId) {
        setError("Ticket no encontrado.");
        setLoading(false);
        return;
      }

      // 1) Exigir login
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData?.session;

      if (!session) {
        router.replace(`/login?redirectTo=${encodeURIComponent(redirectTo)}`);
        return;
      }

      // 2) Traer ticket desde API (service role) => no se rompe por RLS
      try {
        const res = await fetch(`/api/tickets/${encodeURIComponent(ticketId)}`, {
          cache: "no-store",
        });

        const json = await res.json().catch(() => ({}));

        if (!res.ok) {
          setError(json?.error || "Ticket no encontrado.");
          setLoading(false);
          return;
        }

        setTicket(json?.ticket || null);
        setLoading(false);
      } catch (e) {
        setError("Error cargando ticket.");
        setLoading(false);
      }
    };

    run();
  }, [ticketId, redirectTo, router]);

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <div className="bg-white rounded-xl border p-6">Cargando...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <div className="bg-white rounded-xl border p-6">
          <h1 className="text-3xl font-bold">Checkout</h1>
          <p className="text-red-600 mt-2">{error}</p>
          <button
            className="mt-4 px-4 py-2 rounded-lg border"
            onClick={() => router.back()}
          >
            Volver
          </button>
        </div>
      </div>
    );
  }

  const ev = ticket?.events || null;

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="bg-white rounded-xl border p-6">
        <h1 className="text-3xl font-bold">Checkout</h1>

        <div className="mt-4 border rounded-xl p-4">
          <p className="text-sm text-gray-600">Evento</p>
          <p className="text-lg font-semibold">{ev?.title || "—"}</p>
          <p className="text-gray-700">
            {ev?.starts_at ? isoToNice(ev.starts_at) : ""}
            {ev?.venue ? ` · ${ev.venue}` : ""}
            {ev?.city ? `, ${ev.city}` : ""}
          </p>

          <hr className="my-4" />

          <div className="flex items-center justify-between">
            <p className="font-medium">Total</p>
            <p className="text-xl font-bold">{formatCLP(ticket?.price)}</p>
          </div>

          <button
            className="mt-4 w-full px-4 py-3 rounded-lg bg-blue-600 text-white font-semibold"
            onClick={() => alert("Siguiente paso: Webpay / pago")}
          >
            Pagar
          </button>
        </div>

        <button
          className="mt-4 px-4 py-2 rounded-lg border"
          onClick={() => router.back()}
        >
          Volver
        </button>
      </div>
    </div>
  );
}
