"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";

function formatCLP(n) {
  const num = Number(n || 0);
  return num.toLocaleString("es-CL", { style: "currency", currency: "CLP" });
}

function isoToNice(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleString("es-CL", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function EventDetailPage() {
  const { id } = useParams();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [event, setEvent] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [error, setError] = useState("");

  const eventId = useMemo(() => String(id || ""), [id]);

  useEffect(() => {
    if (!eventId) return;

    const run = async () => {
      setLoading(true);
      setError("");

      try {
        const [evRes, tRes] = await Promise.all([
          fetch(`/api/events/${eventId}`, { cache: "no-store" }),
          fetch(`/api/events/${eventId}/tickets`, { cache: "no-store" }),
        ]);

        const evJson = await evRes.json().catch(() => ({}));
        const tJson = await tRes.json().catch(() => ({}));

        if (!evRes.ok) {
          setEvent(null);
          setTickets([]);
          setError(evJson?.error || "Evento no encontrado");
          setLoading(false);
          return;
        }

        setEvent(evJson?.event || null);
        setTickets(Array.isArray(tJson?.tickets) ? tJson.tickets : []);
        setLoading(false);
      } catch (e) {
        setEvent(null);
        setTickets([]);
        setError("Error cargando evento");
        setLoading(false);
      }
    };

    run();
  }, [eventId]);

  const onBuy = async (ticketId) => {
    const { data } = await supabase.auth.getSession();
    const session = data?.session;

    if (!session) {
      const redirectTo = `/checkout?ticket=${encodeURIComponent(ticketId)}`;
      router.push(`/login?redirectTo=${encodeURIComponent(redirectTo)}`);
      return;
    }

    router.push(`/checkout?ticket=${encodeURIComponent(ticketId)}`);
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto p-6">
        <div className="bg-white rounded-xl border p-6">Cargando...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-5xl mx-auto p-6">
        <div className="bg-white rounded-xl border p-6">
          <h1 className="text-2xl font-bold">Evento</h1>
          <p className="text-red-600 mt-2">{error}</p>
          <button
            className="mt-4 px-4 py-2 rounded-lg border"
            onClick={() => router.push("/events")}
          >
            Volver
          </button>
        </div>
      </div>
    );
  }

  const title = event?.title || "Evento";
  const venue = event?.venue || "";
  const city = event?.city ? `, ${event.city}` : "";
  const date = isoToNice(event?.starts_at);

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="bg-white rounded-xl border p-6">
        <div className="flex flex-col md:flex-row gap-6">
          <div className="w-full md:w-72">
            {event?.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={event.image_url}
                alt={title}
                className="w-full h-44 md:h-56 object-cover rounded-xl border"
              />
            ) : (
              <div className="w-full h-44 md:h-56 rounded-xl border bg-gray-50 flex items-center justify-center text-gray-500">
                Sin imagen
              </div>
            )}
          </div>

          <div className="flex-1">
            <h1 className="text-3xl font-bold">{title}</h1>
            <p className="text-gray-700 mt-2">
              {date ? <span className="font-medium">{date}</span> : null}
              {date && (venue || city) ? " · " : null}
              {venue}
              {city}
            </p>

            <div className="mt-4 flex gap-2">
              <button
                className="px-4 py-2 rounded-lg border"
                onClick={() => router.push("/events")}
              >
                Volver
              </button>
              <button
                className="px-4 py-2 rounded-lg bg-blue-600 text-white"
                onClick={() => router.push("/sell")}
              >
                Vender una entrada
              </button>
            </div>
          </div>
        </div>

        <hr className="my-6" />

        <h2 className="text-xl font-semibold">Entradas disponibles</h2>

        {tickets.length === 0 ? (
          <p className="text-gray-600 mt-2">No hay entradas disponibles por ahora.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {tickets.map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between border rounded-xl p-4"
              >
                <div>
                  <p className="font-medium">Entrada</p>
                  <p className="text-gray-700">{formatCLP(t.price)}</p>
                </div>

                <button
                  className="px-4 py-2 rounded-lg bg-green-600 text-white"
                  onClick={() => onBuy(t.id)}
                >
                  Comprar
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
