"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

function IconCalendar(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path
        d="M8 2v2M16 2v2M3 9h18M5 5h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconPin(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path
        d="M12 22s7-4.4 7-12a7 7 0 1 0-14 0c0 7.6 7 12 7 12Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M12 12a2.3 2.3 0 1 0 0-4.6A2.3 2.3 0 0 0 12 12Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function EventPage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params?.id;

  const [event, setEvent] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);

  const [filterSector, setFilterSector] = useState("all");
  const [sortPrice, setSortPrice] = useState("asc");

  useEffect(() => {
    if (!eventId) return;

    async function load() {
      setLoading(true);

      const { data: eventData, error: eventErr } = await supabase
        .from("events")
        .select("*")
        .eq("id", eventId)
        .single();

      if (eventErr) {
        console.error("Error loading event:", eventErr);
        setLoading(false);
        return;
      }

      setEvent(eventData);

      // ✅ FIX: sin join a profiles (evita error por FK inexistente)
      // ✅ y filtramos solo publicaciones activas
      const { data: ticketData, error: ticketErr } = await supabase
        .from("tickets")
        .select("*")
        .eq("event_id", eventId)
        .eq("status", "active");

      if (ticketErr) {
        console.error("Error loading tickets:", ticketErr);
        setTickets([]);
      } else {
        setTickets(ticketData || []);
      }

      setLoading(false);
    }

    load();
  }, [eventId]);

  const sectors = Array.from(
    new Set((tickets || []).map((t) => t.sector).filter(Boolean))
  );

  let visibleTickets = [...(tickets || [])];

  if (filterSector !== "all") {
    visibleTickets = visibleTickets.filter((t) => t.sector === filterSector);
  }

  visibleTickets.sort((a, b) => {
    const ap = Number(a.price || 0);
    const bp = Number(b.price || 0);
    return sortPrice === "asc" ? ap - bp : bp - ap;
  });

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/2" />
          <div className="h-20 bg-gray-200 rounded" />
          <div className="h-80 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-10 text-gray-700">
        No se encontró el evento.
      </div>
    );
  }

  const dateLabel = event?.start_date
    ? new Date(event.start_date).toLocaleString("es-CL", {
        weekday: "short",
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "Fecha por confirmar";

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-4xl font-black text-gray-900">{event.title}</h1>
            <div className="mt-3 flex flex-col gap-2 text-gray-700">
              <div className="flex items-center gap-2">
                <IconCalendar className="w-5 h-5 text-gray-500" />
                <span>{dateLabel}</span>
              </div>
              <div className="flex items-center gap-2">
                <IconPin className="w-5 h-5 text-gray-500" />
                <span>
                  {event.city || "Ciudad"} · {event.venue || event.city || "Lugar"}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={() => router.push(`/sell?event=${eventId}`)}
            className="rounded-xl bg-blue-600 text-white px-5 py-3 font-bold hover:bg-blue-700"
          >
            Vender entrada
          </button>
        </div>

        <div className="mt-10 grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <h2 className="text-xl font-black text-gray-900">
              Entradas disponibles
            </h2>

            <div className="mt-4 flex flex-wrap gap-3">
              <select
                value={filterSector}
                onChange={(e) => setFilterSector(e.target.value)}
                className="rounded-xl border px-4 py-2 bg-white"
              >
                <option value="all">Todos los sectores</option>
                {sectors.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>

              <select
                value={sortPrice}
                onChange={(e) => setSortPrice(e.target.value)}
                className="rounded-xl border px-4 py-2 bg-white"
              >
                <option value="asc">Precio: menor a mayor</option>
                <option value="desc">Precio: mayor a menor</option>
              </select>
            </div>

            <div className="mt-5 space-y-4">
              {visibleTickets.length === 0 ? (
                <div className="rounded-2xl border bg-white p-6 text-gray-700">
                  Aún no hay entradas publicadas para este evento.
                </div>
              ) : (
                visibleTickets.map((t) => (
                  <div
                    key={t.id}
                    className="rounded-2xl border bg-white p-5 flex items-center justify-between"
                  >
                    <div>
                      <div className="font-black text-gray-900">
                        {t.title || "Entrada"}
                      </div>
                      <div className="text-sm text-gray-600">
                        {t.sector || "Sector"} · {t.row || t.fila || "Fila"} ·{" "}
                        {t.seat || t.asiento || "Asiento"}
                      </div>
                      <div className="text-sm text-gray-600">
                        {t?.seller_name
                          ? `Publicado por ${t.seller_name}`
                          : "Publicado por vendedor"}
                      </div>
                      <div className="mt-1 font-black text-gray-900">
                        {Number(t.price || 0).toLocaleString("es-CL", {
                          style: "currency",
                          currency: "CLP",
                          maximumFractionDigits: 0,
                        })}
                      </div>
                      {t.original_price ? (
                        <div className="text-xs text-gray-500">
                          Precio original:{" "}
                          {Number(t.original_price).toLocaleString("es-CL", {
                            style: "currency",
                            currency: "CLP",
                            maximumFractionDigits: 0,
                          })}
                        </div>
                      ) : null}
                    </div>

                    <button
                      onClick={() => router.push(`/checkout?ticket=${t.id}`)}
                      className="rounded-xl bg-green-600 text-white px-4 py-2 font-bold hover:bg-green-700"
                    >
                      Comprar
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="lg:col-span-1 space-y-4">
            <div className="rounded-2xl border p-5 bg-white">
              <h3 className="font-bold text-gray-900">Cómo funciona TixSwap</h3>
              <ol className="mt-3 text-sm text-gray-700 space-y-2 list-decimal list-inside">
                <li>El vendedor publica y sube su ticket (PDF).</li>
                <li>
                  Compras dentro de TixSwap: tu pago queda protegido mientras se
                  coordina la entrega.
                </li>
                <li>
                  Cuando el ticket está OK para usar, liberamos el pago al
                  vendedor. Si hay un problema validado, gestionamos el reembolso.
                </li>
              </ol>
            </div>

            <div className="rounded-2xl border p-5 bg-white">
              <h3 className="font-bold text-gray-900">
                Recomendaciones para evitar estafas
              </h3>
              <ul className="mt-3 text-sm text-gray-700 space-y-2 list-disc list-inside">
                <li>Paga siempre dentro de TixSwap (nunca transferencia por fuera).</li>
                <li>Revisa bien sector/fila/asiento y que coincida con el evento y la fecha.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
