"use client";

// app/dashboard/purchases/page.jsx
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { formatCLP } from "@/lib/format";

export default function PurchasesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState([]);
  const [err, setErr] = useState("");

  const load = async () => {
    setErr("");
    setLoading(true);

    const { data: sessionRes } = await supabase.auth.getSession();
    const token = sessionRes?.session?.access_token;

    if (!token) {
      router.replace(`/login?redirectTo=${encodeURIComponent("/dashboard/purchases")}`);
      return;
    }

    try {
      const r = await fetch("/api/orders/my", {
        headers: { Authorization: `Bearer ${token}` },
      });

      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setErr(j?.error || "No se pudieron cargar tus compras.");
        setOrders([]);
      } else {
        setOrders(j?.orders || []);
      }
    } catch (e) {
      setErr("Error de red cargando tus compras.");
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const download = async (orderId) => {
    setErr("");

    const { data: sessionRes } = await supabase.auth.getSession();
    const token = sessionRes?.session?.access_token;

    if (!token) {
      router.replace(`/login?redirectTo=${encodeURIComponent("/dashboard/purchases")}`);
      return;
    }

    try {
      const r = await fetch("/api/orders/download", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ orderId }),
      });

      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setErr(j?.error || "No se pudo descargar.");
        return;
      }

      if (!j?.url) {
        setErr("No se encontró la URL de descarga.");
        return;
      }

      window.open(j.url, "_blank");
    } catch (e) {
      setErr("Error de red descargando.");
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/events" className="text-sm text-slate-600 hover:text-blue-600">
            ← Volver a eventos
          </Link>
          <h1 className="mt-3 text-3xl font-bold text-slate-900">Mis compras</h1>
          <p className="mt-2 text-slate-600">Aquí verás tus compras y podrás descargar tus entradas.</p>
        </div>

        <button
          onClick={load}
          className="border px-5 py-2.5 rounded-full font-semibold hover:bg-slate-50"
        >
          Recargar
        </button>
      </div>

      {err && (
        <div className="mt-6 border border-red-200 bg-red-50 text-red-700 rounded-xl p-4">
          {err}
        </div>
      )}

      <div className="mt-8">
        {loading ? (
          <p className="text-slate-600">Cargando…</p>
        ) : orders.length === 0 ? (
          <p className="text-slate-600">Aún no tienes compras.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {orders.map((o) => {
              const ev = o?.ticket?.event;
              const status = o?.status || "pending";
              const total = o?.total_paid_clp ?? o?.amount;

              return (
                <div key={o.id} className="bg-white border rounded-xl p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-lg font-bold text-slate-900">
                        {ev?.title || "Compra"}
                      </p>
                      <p className="text-sm text-slate-600">
                        Orden: <b>{o.id}</b> · Estado: <b>{status}</b>
                      </p>
                      <p className="mt-2 font-bold text-slate-900">{formatCLP(total)}</p>
                    </div>

                    <div className="shrink-0 flex gap-2 items-center">
                      {status === "paid" ? (
                        <button
                          onClick={() => download(o.id)}
                          className="bg-blue-600 text-white px-5 py-2.5 rounded-full font-semibold hover:opacity-90"
                        >
                          Descargar
                        </button>
                      ) : (
                        <span className="px-4 py-2 rounded-full bg-slate-100 text-slate-700 font-semibold">
                          {status}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
