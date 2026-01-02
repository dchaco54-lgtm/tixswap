"use client";

// app/checkout/success/page.jsx
import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

export default function CheckoutSuccessPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const orderId = sp.get("orderId");

  useEffect(() => {
    const t = setTimeout(() => {
      router.replace("/dashboard/purchases");
    }, 8000);

    return () => clearTimeout(t);
  }, [router]);

  return (
    <div className="max-w-xl mx-auto px-4 py-16">
      <h1 className="text-3xl font-bold text-slate-900">🎉 Felicidades por tu compra</h1>
      <p className="mt-3 text-slate-700">
        {orderId ? <>Orden <b>{orderId}</b>. </> : null}
        Revisa tu correo y descarga tu entrada desde el módulo <b>Mis compras</b>.
      </p>
      <p className="mt-2 text-slate-600">Si no haces nada, en 8 segundos te llevamos a Mis compras.</p>

      <div className="mt-8">
        <Link
          href="/dashboard/purchases"
          className="bg-blue-600 text-white px-6 py-3 rounded-full font-semibold hover:opacity-90"
        >
          Ir a mis compras
        </Link>
      </div>
    </div>
  );
}
