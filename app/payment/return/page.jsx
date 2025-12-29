"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function PaymentReturnPage() {
  const router = useRouter();
  const sp = useSearchParams();

  const orderId = useMemo(() => sp.get("order") || "", [sp]);

  const [status, setStatus] = useState("Confirmando pago...");
  const [error, setError] = useState("");

  useEffect(() => {
    async function run() {
      setError("");

      if (!orderId) {
        setError("Falta order.");
        setStatus("Error");
        return;
      }

      try {
        const res = await fetch("/api/payments/banchile/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId }),
        });

        if (res.status === 401) {
          const redirectTo = `/payment/return?order=${encodeURIComponent(orderId)}`;
          router.replace(`/login?redirectTo=${encodeURIComponent(redirectTo)}`);
          return;
        }

        const json = await res.json().catch(() => ({}));

        if (!res.ok) throw new Error(json?.error || "No se pudo confirmar.");

        if (json?.state === "APPROVED") {
          setStatus("Pago aprobado ✅ Liberando tu ticket...");
          setTimeout(() => {
            router.replace(`/dashboard/purchases?order=${encodeURIComponent(orderId)}`);
          }, 700);
          return;
        }

        if (json?.state === "REJECTED") {
          setStatus("Pago rechazado ❌");
          setTimeout(() => {
            router.replace(`/dashboard/purchases?order=${encodeURIComponent(orderId)}`);
          }, 900);
          return;
        }

        setStatus("Pago pendiente / en revisión ⏳");
        setTimeout(() => {
          router.replace(`/dashboard/purchases?order=${encodeURIComponent(orderId)}`);
        }, 900);
      } catch (e) {
        setError(e?.message || "Error confirmando pago.");
        setStatus("Error");
      }
    }

    run();
  }, [orderId, router]);

  return (
    <div className="max-w-xl mx-auto px-4 py-14">
      <div className="rounded-2xl border bg-white p-6">
        <h1 className="text-2xl font-extrabold text-gray-900">Resultado de pago</h1>
        <p className="mt-4 text-gray-700">{status}</p>
        {error ? <p className="mt-3 text-red-600">{error}</p> : null}

        <div className="mt-4 text-xs text-gray-500">
          Orden: <span className="font-mono">{orderId || "-"}</span>
        </div>
      </div>
    </div>
  );
}
