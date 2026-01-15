// app/dashboard/purchases/[orderId]/page.jsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import StarRating from "@/components/StarRating";

function formatCLP(value) {
  const n = Number(value ?? 0);
  return n.toLocaleString("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  });
}

export default function PurchaseDetailPage() {
  const params = useParams();
  const orderId = params?.orderId;

  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!orderId) return;

    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.access_token) {
          setOrder(null);
          setError("Debes iniciar sesión.");
          return;
        }

        const res = await fetch(`/api/orders/${orderId}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });

        const data = await res.json();

        if (!res.ok) throw new Error(data?.error || "No se pudo cargar la compra.");

        if (!cancelled) setOrder(data.order || null);
      } catch (e) {
        console.error(e);
        if (!cancelled) setError("No se pudo cargar el detalle de la compra.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  const event = order?.ticket?.event;
  const seller = order?.ticket?.seller;
  const sellerRep = useMemo(() => Number(seller?.reputation ?? 0), [seller]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <Link href="/dashboard/purchases" className="text-blue-600 hover:underline">
          ← Volver a Mis compras
        </Link>

        <div className="mt-3">
          {loading ? (
            <div className="bg-white rounded-lg shadow-sm p-6">Cargando...</div>
          ) : error ? (
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-md px-4 py-3">
                {error}
              </div>
            </div>
          ) : !order ? (
            <div className="bg-white rounded-lg shadow-sm p-6 text-gray-600">
              No hay información para mostrar.
            </div>
          ) : (
            <>
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h1 className="text-2xl font-bold">Detalle de compra</h1>
                <p className="text-gray-600 mt-1">
                  {new Date(order.created_at).toLocaleString("es-CL")}
                </p>

                <div className="border-t my-5" />

                <div className="text-sm text-gray-500">Evento</div>
                <div className="text-xl font-semibold">{event?.name || "Evento"}</div>
                <div className="text-gray-600">
                  {(event?.city || "Santiago") + (event?.venue ? ` • ${event.venue}` : "")}
                </div>

                <div className="border-t my-5" />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-gray-500">Entrada</div>
                    <div className="font-medium">
                      {order?.ticket?.section || order?.ticket?.row || order?.ticket?.seat
                        ? `${order?.ticket?.section || "-"} / ${order?.ticket?.row || "-"} / ${order?.ticket?.seat || "-"}`
                        : "Sin ubicación"}
                    </div>
                  </div>

                  <div>
                    <div className="text-gray-500">Vendedor</div>
                    <div className="font-medium">{seller?.username || "Vendedor"}</div>
                    <div className="flex items-center gap-3 mt-2">
                      <StarRating value={sellerRep} />
                      <div className="text-gray-700 font-medium">{sellerRep.toFixed(1)}/5</div>
                    </div>
                  </div>
                </div>

                <div className="border-t my-5" />

                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-gray-500 text-sm">Total pagado</div>
                    <div className="text-xl font-bold">{formatCLP(order.total_amount)}</div>
                  </div>

                  <div className="flex items-center gap-3">
                    {order.status === "paid" && (
                      <a
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium"
                        href={`/api/orders/download?orderId=${order.id}`}
                      >
                        Descargar PDF
                      </a>
                    )}

                    <button
                      disabled
                      className="bg-gray-200 text-gray-500 px-4 py-2 rounded-md font-medium cursor-not-allowed"
                      title="Chat viene en el siguiente paso"
                    >
                      Chat (pronto)
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
