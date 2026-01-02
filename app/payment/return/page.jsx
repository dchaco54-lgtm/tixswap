"use client";

// app/payment/return/page.jsx
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

export default function PaymentReturnPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const orderId = sp.get("orderId");

  const [msg, setMsg] = useState("Confirmando tu pago…");
  const [err, setErr] = useState("");

  useEffect(() => {
    const run = async () => {
      if (!orderId) {
        setErr("Falta orderId en el retorno del pago.");
        setMsg("");
        return;
      }

      const { data: sessionRes } = await supabase.auth.getSession();
      const token = sessionRes?.session?.access_token;

      if (!token) {
        router.replace(`/login?redirectTo=${encodeURIComponent(`/payment/return?orderId=${orderId}`)}`);
        return;
      }

      try {
        const r = await fetch("/api/payments/banchile/confirm", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ orderId }),
        });

        const j = await r.json().catch(() => ({}));
        if (!r.ok) {
          setErr(j?.error || "No se pudo confirmar el pago.");
          setMsg("");
          return;
        }

        // Estado del banco (ej: APPROVED/REJECTED/PENDING)
        if (j?.state === "APPROVED") {
          router.replace(`/checkout/success?orderId=${encodeURIComponent(orderId)}`);
          return;
        }

        if (j?.state === "REJECTED") {
          setMsg("Pago rechazado 😕");
          setErr("Intenta nuevamente o usa otro método cuando esté disponible.");
          return;
        }

        setMsg("Pago pendiente…");
        setErr("El banco aún no confirma. Revisa en “Mis compras” en unos minutos.");
      } catch (e) {
        setErr("Error de red confirmando el pago.");
        setMsg("");
      }
    };

    run();
  }, [orderId, router]);

  return (
    <div className="max-w-xl mx-auto px-4 py-16">
      <h1 className="text-2xl font-bold text-slate-900">Estado de tu pago</h1>

      {msg && <p className="mt-3 text-slate-700">{msg}</p>}
      {err && <p className="mt-3 text-red-600">{err}</p>}

      <div className="mt-8 flex gap-3">
        <Link
          href="/dashboard/purchases"
          className="bg-blue-600 text-white px-5 py-2.5 rounded-full font-semibold hover:opacity-90"
        >
          Ir a mis compras
        </Link>
        <Link href="/events" className="px-5 py-2.5 rounded-full border font-semibold">
          Volver a eventos
        </Link>
      </div>
    </div>
  );
}

