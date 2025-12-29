"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Calendar, MapPin } from "lucide-react";

export default function EventDetailPage() {
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

      const { data: ticketData, error: ticketErr } = await supabase
        .from("tickets")
        .select("*, profiles(full_name)")
        .eq("event_id", eventId);

      if (ticketErr) {
        console.error("Error loading tickets:", ticketErr);
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
          <div className="h-8 bg-gray-200 rounded w-2/3" />
          <div className="h-4 bg-gray-200 rounded w-1/3" />
          <div className="h-4 bg-gray-200 rounded w-1/2" />
          <div className="h-40 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <p className="text-gray-600">Evento no encontrado.</p>
      </div>
    );
  }

  const startsAt = event?.starts_at ? new Date(event.starts_at) : null;
  const dateLabel = startsAt
    ? startsAt.toLocaleDateString("es-CL", {
        weekday: "short",
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : "Fecha por confirmar";

  const timeLabel = startsAt
    ? startsAt.toLocaleTimeString("es-CL", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

  const placeLabel = [event?.city, event?.venue].filter(Boolean).join(" · ");

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-gray-900">
              {event.title}
            </h1>

            <div className="mt-3 flex flex-col gap-2 text-gray-600">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                <span>
                  {dateLabel}
                  {timeLabel ? `, ${timeLabel}` : ""}
                </span>
              </div>

              {placeLabel ? (
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  <span>{placeLabel}</span>
                </div>
              ) : null}
            </div>
          </div>

          <div className="hidden sm:block">
            <button
              onClick={() => router.push("/sell")}
              className="rounded-xl bg-blue-600 text-white px-4 py-2 font-semibold hover:bg-blue-700"
            >
              Vender entrada
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
          <div className="lg:col-span-2">
            <h2 className="text-xl font-bold text-gray-900">
              Entradas disponibles
            </h2>

            <div className="mt-4 flex flex-col sm:flex-row gap-3">
              <select
                className="rounded-xl border px-3 py-2 bg-white"
                value={filterSector}
                onChange={(e) => setFilterSector(e.target.value)}
              >
                <option value="all">Todos los sectores</option>
                {sectors.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>

              <select
                className="rounded-xl border px-3 py-2 bg-white"
                value={sortPrice}
                onChange={(e) => setSortPrice(e.target.value)}
              >
                <option value="asc">Precio: menor a mayor</option>
                <option value="desc">Precio: mayor a menor</option>
              </select>
            </div>

            <div className="mt-6 space-y-4">
              {visibleTickets.length === 0 ? (
                <div className="rounded-2xl border p-5 bg-white">
                  <p className="text-gray-600">
                    Aún no hay entradas publicadas para este evento.
                  </p>
                </div>
              ) : (
                visibleTickets.map((t) => (
                  <div
                    key={t.id}
                    className="rounded-2xl border p-5 bg-white flex items-center justify-between gap-4"
                  >
                    <div>
                      <div className="font-bold text-gray-900">
                        Entrada · {t.sector || "Sector"}
                      </div>
                      <div className="text-sm text-gray-600">
                        {t?.profiles?.full_name
                          ? `Publicado por ${t.profiles.full_name}`
                          : "Publicado por vendedor"}
                      </div>
                      <div className="text-sm text-gray-600">
                        {t.row ? `Fila ${t.row}` : ""}
                        {t.seat ? ` · Asiento ${t.seat}` : ""}
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="font-extrabold text-green-700 text-lg">
                        {Number(t.price || 0).toLocaleString("es-CL", {
                          style: "currency",
                          currency: "CLP",
                          maximumFractionDigits: 0,
                        })}
                      </div>

                      <button
                        onClick={() => router.push(`/checkout?ticket=${t.id}`)}
                        className="rounded-xl bg-green-600 text-white px-4 py-2 font-bold hover:bg-green-700"
                      >
                        Comprar
                      </button>
                    </div>
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
                  vendedor. Si hay un problema validado, gestionamos el
                  reembolso.
                </li>
              </ol>
            </div>

            <div className="rounded-2xl border p-5 bg-white">
              <h3 className="font-bold text-gray-900">
                Recomendaciones para evitar estafas
              </h3>
              <ul className="mt-3 text-sm text-gray-700 space-y-2 list-disc list-inside">
                <li>Paga siempre dentro de TixSwap (nunca transferencia por fuera).</li>
                <li>
                  Revisa bien sector/fila/asiento y que coincida con el evento y
                  la fecha.
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
