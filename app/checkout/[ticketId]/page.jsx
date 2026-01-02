
"use client";

// app/checkout/[ticketId]/page.jsx
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { formatCLP } from "@/lib/format";

export default function CheckoutTicketPage() {
  const router = useRouter();
  const params = useParams();
  const ticketId = params?.ticketId;

  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [err, setErr] = useState("");
  const [preview, setPreview] = useState(null);

  const returnUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/payment/return`;
  }, []);

  useEffect(() => {
    const run = async () => {
      setErr("");
      setLoading(true);

      const { data: sessionRes } = await supabase.auth.getSession();
      const token = sessionRes?.session?.access_token;

      if (!token) {
        router.replace(`/login?redirectTo=${encodeURIComponent(`/checkout/${ticketId}`)}`);
        return;
      }

      try {
        const r = await fetch(`/api/checkout/preview?ticketId=${encodeURIComponent(ticketId)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        const j = await r.json().catch(() => ({}));
        if (!r.ok) {
          setErr(j?.error || "No se pudo cargar el checkout.");
          setPreview(null);
        } else {
          setErr("");
          setPreview(j);
        }
      } catch (e) {
        setErr("Error de red cargando el checkout.");
        setPreview(null);
      } finally {
        setLoading(false);
      }
    };

    if (ticketId) run();
  }, [ticketId, router]);

  const handlePayBanchile = async () => {
    setErr("");
    setPaying(true);

    const { data: sessionRes } = await supabase.auth.getSession();
    const token = sessionRes?.session?.access_token;

    if (!token) {
      router.replace(`/login?redirectTo=${encodeURIComponent(`/checkout/${ticketId}`)}`);
      return;
    }

    try {
      const r = await fetch("/api/payments/banchile/create-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ ticketId, returnUrl }),
      });

      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setErr(j?.error || "No se pudo iniciar el pago.");
        setPaying(false);
        return;
      }

      const redirectUrl = j?.redirectUrl;
      if (!redirectUrl) {
        setErr("El banco no devolvió redirectUrl. Revisa BANCHILE_* en Vercel.");
        setPaying(false);
        return;
      }

      window.location.href = redirectUrl;
    } catch (e) {
      setErr("Error de red iniciando pago.");
      setPaying(false);
    }
  };

  if (loading) {
    return <div className="max-w-3xl mx-auto px-4 py-16 text-slate-600">Cargando checkout…</div>;
  }

  if (!preview) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16">
        <Link href="/events" className="text-sm text-slate-600 hover:text-blue-600">
          ← Volver a eventos
        </Link>
        <h1 className="mt-4 text-2xl font-bold text-slate-900">No se pudo cargar</h1>
        <p className="mt-2 text-red-600">{err || "Ticket no disponible."}</p>
      </div>
    );
  }

  const t = preview.ticket;
  const fees = preview.feeBreakdown || preview.fees || null;

  return (
    <div className="max-w-3xl mx-auto px-4 py-16">
      <Link href={`/events/${t.event_id}`} className="text-sm text-slate-600 hover:text-blue-600">
        ← Volver al evento
      </Link>

      <h1 className="mt-3 text-3xl font-bold text-slate-900">Checkout</h1>
      <p className="mt-2 text-slate-600">Revisa tu entrada y paga seguro.</p>

      {err && (
        <div className="mt-6 border border-red-200 bg-red-50 text-red-700 rounded-xl p-4">
          {err}
        </div>
      )}

      <div className="mt-8 bg-white border rounded-2xl p-6 shadow-sm">
        <h2 className="text-xl font-bold text-slate-900">Detalle de la entrada</h2>

        <div className="mt-4 text-slate-700 space-y-1">
          {t.section && (
            <p>
              Sección: <b>{t.section}</b>
            </p>
          )}
          {t.row && (
            <p>
              Fila: <b>{t.row}</b>
            </p>
          )}
          {t.seat && (
            <p>
              Asiento: <b>{t.seat}</b>
            </p>
          )}
          {t.notes && <p className="text-sm text-slate-600">{t.notes}</p>}
        </div>

        <div className="mt-6 border-t pt-5">
          <div className="flex items-center justify-between text-slate-700">
            <span>Precio</span>
            <b>{formatCLP(fees?.price ?? t.price)}</b>
          </div>
          <div className="mt-2 flex items-center justify-between text-slate-700">
            <span>Fee TixSwap</span>
            <b>{formatCLP(fees?.buyerFee ?? 0)}</b>
          </div>

          <div className="mt-3 flex items-center justify-between text-slate-900 text-lg">
            <span>Total</span>
            <b>{formatCLP(fees?.total ?? t.price)}</b>
          </div>
        </div>
      </div>

      <div className="mt-8 bg-white border rounded-2xl p-6 shadow-sm">
        <h2 className="text-xl font-bold text-slate-900">Elige tu método de pago</h2>
        <p className="mt-2 text-slate-600">
          Hoy probamos Banco de Chile. Los demás quedan listos “pronto”.
        </p>

        <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3">
          <button
            onClick={handlePayBanchile}
            disabled={paying}
            className="border rounded-xl p-4 text-left hover:border-blue-500 disabled:opacity-60"
          >
            <div className="font-bold text-slate-900">Banco de Chile</div>
            <div className="text-sm text-slate-600">Checkout BanchilePagos</div>
            <div className="mt-3 inline-block bg-blue-600 text-white px-4 py-2 rounded-full font-semibold">
              {paying ? "Redirigiendo…" : "Pagar"}
            </div>
          </button>

          <div className="border rounded-xl p-4 opacity-50">
            <div className="font-bold text-slate-900">Webpay</div>
            <div className="text-sm text-slate-600">Pronto</div>
          </div>

          <div className="border rounded-xl p-4 opacity-50">
            <div className="font-bold text-slate-900">Mercado Pago</div>
            <div className="text-sm text-slate-600">Pronto</div>
          </div>
        </div>
      </div>
    </div>
  );
}
