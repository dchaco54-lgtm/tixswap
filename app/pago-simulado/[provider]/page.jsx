"use client";

import { useMemo } from "react";
import { useSearchParams, useParams } from "next/navigation";
import Link from "next/link";

function formatCLP(amount) {
  const n = Number(amount || 0);
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(n) ? n : 0);
}

export default function PagoSimuladoPage() {
  const { provider } = useParams();
  const sp = useSearchParams();

  const ticketId = sp.get("ticketId");
  const amount = sp.get("amount");
  const returnUrl = sp.get("returnUrl") || "/";
  const token = sp.get("token");

  const providerName = useMemo(() => {
    if (provider === "webpay") return "Webpay";
    if (provider === "banco-chile") return "Banco de Chile";
    return String(provider || "Pago");
  }, [provider]);

  const go = (state) => {
    try {
      const url = new URL(returnUrl, window.location.origin);
      url.searchParams.set("payment", state); // success | cancel
      url.searchParams.set("provider", provider);
      if (ticketId) url.searchParams.set("ticketId", ticketId);
      if (token) url.searchParams.set("token", token);
      window.location.href = url.toString();
    } catch {
      window.location.href = "/";
    }
  };

  return (
    <div className="max-w-xl mx-auto px-4 py-16">
      <div className="tix-card p-6">
        <h1 className="text-2xl font-bold text-slate-900">
          Simulación de pago — {providerName}
        </h1>

        <p className="mt-2 text-slate-600">
          Aún no hay credenciales del proveedor. Este flujo simulado evita que el
          checkout se quede pegado y permite probar UX end-to-end.
        </p>

        <div className="mt-6 grid gap-2 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500">Ticket</span>
            <span className="font-medium">{ticketId || "-"}</span>
          </div>

          <div className="flex justify-between">
            <span className="text-slate-500">Monto</span>
            <span className="font-medium">{formatCLP(amount)}</span>
          </div>
        </div>

        <div className="mt-8 flex flex-col sm:flex-row gap-3">
          <button className="tix-btn-primary w-full" onClick={() => go("success")}>
            Simular pago exitoso
          </button>
          <button className="tix-btn-secondary w-full" onClick={() => go("cancel")}>
            Cancelar
          </button>
        </div>

        <p className="mt-6 text-xs text-slate-500 break-all">
          Return URL: {returnUrl}
        </p>
      </div>

      <div className="mt-6 text-center">
        <Link href="/events" className="tix-link">
          Volver a eventos
        </Link>
      </div>
    </div>
  );
}
