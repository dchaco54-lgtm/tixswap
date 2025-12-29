"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function PaymentReturnPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderId = searchParams.get("orderId");

  const [status, setStatus] = useState("Procesando tu pago...");
  const [isError, setIsError] = useState(false);
  const canContinue = useMemo(() => !!orderId, [orderId]);

  useEffect(() => {
    if (!canContinue) return;

    const run = async () => {
      try {
        setStatus("Confirmando pago con la pasarela...");
        const res = await fetch("/api/payments/banchile/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId }),
        });

        const data = await res.json().catch(() => null);

        if (!res.ok) {
          setIsError(true);
          setStatus(data?.error || "No pudimos confirmar el pago.");
          return;
        }

        if (data?.state === "APPROVED") {
          setIsError(false);
          setStatus("Pago aprobado ✅ Redirigiendo a tus compras...");
          setTimeout(() => router.replace(`/dashboard?section=purchases&orderId=${orderId}`), 800);
          return;
        }

        if (data?.state === "REJECTED") {
          setIsError(true);
          setStatus("Pago rechazado ❌ Puedes intentar nuevamente.");
          return;
        }

        setIsError(false);
        setStatus("Tu pago está pendiente. Te redirigiremos a Mis compras.");
        setTimeout(() => router.replace(`/dashboard?section=purchases&orderId=${orderId}`), 1500);
      } catch (e) {
        console.error(e);
        setIsError(true);
        setStatus("Error inesperado confirmando el pago.");
      }
    };

    run();
  }, [canContinue, orderId, router]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="w-full max-w-lg rounded-2xl border bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold">Pago en TixSwap</h1>
        <p className="mt-2 text-sm text-gray-600">Estamos validando tu transacción.</p>

        <div className={`mt-6 rounded-xl border p-4 ${isError ? "border-red-200 bg-red-50" : "border-blue-200 bg-blue-50"}`}>
          <p className="text-sm">{status}</p>
        </div>

        <div className="mt-6 flex gap-3">
          <button className="rounded-xl border px-4 py-2 text-sm" onClick={() => router.replace("/")}>
            Volver al inicio
          </button>
          <button className="rounded-xl bg-blue-600 px-4 py-2 text-sm text-white" onClick={() => router.replace("/dashboard?section=purchases")}>
            Ir a Mis compras
          </button>
        </div>

        {!orderId && (
          <p className="mt-4 text-xs text-gray-500">
            * No llegó orderId. Revisa tu returnUrl configurada en create-session.
          </p>
        )}
      </div>
    </div>
  );
}
