// app/dashboard/purchases/page.jsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import supabase from "@/lib/supabaseClient";
import StarRating from "@/components/StarRating";

function formatCLP(value) {
  const n = Number(value ?? 0);
  return n.toLocaleString("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  });
}

export default function PurchasesPage() {
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState([]);
  const [buyerProfile, setBuyerProfile] = useState(null);
  const [error, setError] = useState(null);

  async function load() {
    try {
      setLoading(true);
      setError(null);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      // Perfil comprador (reputación)
      const userId = session?.user?.id;
      if (userId) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("id, username, reputation")
          .eq("id", userId)
          .single();
        setBuyerProfile(profile || null);
      } else {
        setBuyerProfile(null);
      }

      if (!session?.access_token) {
        setOrders([]);
        return;
      }

      const res = await fetch("/api/orders/my", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      const data = await res.json();
      setOrders(data.orders || []);
    } catch (e) {
      console.error(e);
      setError("No se pudieron cargar las compras.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const buyerRep = useMemo(
    () => Number(buyerProfile?.reputation ?? 0),
    [buyerProfile]
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Link href="/events" className="text-blue-600 hover:underline">
              ← Volver a eventos
            </Link>

            <h1 className="text-3xl font-bold mt-2">Mis compras</h1>
            <p className="text-gray-600 mt-1">
              Aquí verás tus compras y podrás descargar tus entradas.
            </p>

            <div className="mt-3 bg-white rounded-lg border p-4 inline-block">
              <div className="text-sm text-gray-500">Tu reputación de comprador</div>
              <div className="flex items-center gap-3 mt-1">
                <StarRating value={buyerRep} />
                <div className="text-gray-700 font-medium">
                  {buyerRep.toFixed(1)}/5
                </div>
                {buyerProfile?.username && (
                  <div className="text-gray-500 text-sm">({buyerProfile.username})</div>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={load}
            className="bg-white border px-4 py-2 rounded-lg hover:bg-gray-50"
          >
            Recargar
          </button>
        </div>

        <div className="mt-6">
          {loading ? (
            <div className="bg-white rounded-lg shadow-sm p-6">Cargando...</div>
          ) : error ? (
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-md px-4 py-3">
                {error}
              </div>
            </div>
          ) : orders.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm p-6 text-gray-600">
              Aún no tienes compras.
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
              <div className="grid grid-cols-12 gap-2 px-4 py-3 border-b text-xs font-semibold text-gray-600">
                <div className="col-span-4">Evento</div>
                <div className="col-span-2">Total</div>
                <div className="col-span-2">Vendedor</div>
                <div className="col-span-2">Estado</div>
                <div className="col-span-2 text-right">Acciones</div>
              </div>

              {orders.map((o) => {
                const event = o?.ticket?.event;
                const seller = o?.ticket?.seller;
                const total = o?.total_amount ?? 0;

                return (
                  <div
                    key={o.id}
                    className="grid grid-cols-12 gap-2 px-4 py-4 border-b last:border-b-0 items-center"
                  >
                    <div className="col-span-4">
                      <div className="font-medium text-gray-900">
                        {event?.name || "Evento"}
                      </div>
                      <div className="text-sm text-gray-600">
                        {(event?.city || "Santiago") +
                          (event?.venue ? ` • ${event.venue}` : "")}
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        {new Date(o.created_at).toLocaleString("es-CL")}
                      </div>
                    </div>

                    <div className="col-span-2 font-semibold">{formatCLP(total)}</div>

                    <div className="col-span-2">
                      <div className="text-sm font-medium text-gray-900">
                        {seller?.username || "Vendedor"}
                      </div>
                      <div className="text-xs text-gray-500">
                        {(Number(seller?.reputation ?? 0)).toFixed(1)}/5
                      </div>
                    </div>

                    <div className="col-span-2">
                      <span className="inline-flex text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-700">
                        {o.status}
                      </span>
                    </div>

                    <div className="col-span-2 flex items-center justify-end gap-2">
                      <Link
                        href={`/dashboard/purchases/${o.id}`}
                        className="text-blue-600 hover:underline text-sm"
                      >
                        Ver
                      </Link>

                      {o.status === "paid" && (
                        <a
                          href={`/api/orders/download?orderId=${o.id}`}
                          className="text-blue-600 hover:underline text-sm"
                        >
                          PDF
                        </a>
                      )}

                      <button
                        disabled
                        className="text-sm text-gray-400 cursor-not-allowed"
                        title="Chat viene en el siguiente paso"
                      >
                        Chat
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

