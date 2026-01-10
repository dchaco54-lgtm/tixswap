// app/events/[id]/page.jsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import supabase from "@/lib/supabaseClient";

function formatCurrencyCLP(value) {
  const n = Number(value ?? 0);
  return n.toLocaleString("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  });
}

function safeString(v, fallback = "—") {
  if (v === null || v === undefined) return fallback;
  const s = String(v).trim();
  return s.length ? s : fallback;
}

const AVAILABLE_STATUSES = ["active", "available", "listed"]; // tolerante (históricos)

export default function EventDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id;

  const [event, setEvent] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const locationText = useMemo(() => {
    if (!event) return "";
    const city = event.city ? ` • ${event.city}` : "";
    const venue = event.venue ? ` • ${event.venue}` : "";
    return `${city}${venue}`.trim();
  }, [event]);

  useEffect(() => {
    if (!id) return;

    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        // 1) Evento
        const { data: eventData, error: eventError } = await supabase
          .from("events")
          .select("id, name, venue, city, date")
          .eq("id", id)
          .single();

        if (eventError) throw eventError;
        if (!cancelled) setEvent(eventData);

        // 2) Tickets (sin joins frágiles)
        const { data: ticketRows, error: ticketsError } = await supabase
          .from("tickets")
          .select("id, price, section, row, seat, seller_id, status, created_at")
          .eq("event_id", id)
          .in("status", AVAILABLE_STATUSES)
          .order("created_at", { ascending: false });

        if (ticketsError) throw ticketsError;

        const sellerIds = Array.from(
          new Set((ticketRows || []).map((t) => t.seller_id).filter(Boolean))
        );

        // 3) Perfiles del vendedor (2da query => robusto)
        let profilesById = {};
        if (sellerIds.length > 0) {
          const { data: profiles, error: profilesError } = await supabase
            .from("profiles")
            .select("id, username, reputation")
            .in("id", sellerIds);

          // Si falla, NO rompas tickets
          if (!profilesError && profiles) {
            profilesById = profiles.reduce((acc, p) => {
              acc[p.id] = p;
              return acc;
            }, {});
          }
        }

        const merged = (ticketRows || []).map((t) => ({
          ...t,
          seller: profilesById[t.seller_id] || null,
        }));

        if (!cancelled) setTickets(merged);
      } catch (err) {
        console.error("Error cargando evento/tickets:", err);
        if (!cancelled) {
          setTickets([]);
          setError("No pudimos cargar las entradas en este momento.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  function handleBuy(ticketId) {
    router.push(`/checkout/${ticketId}`);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <button
          onClick={() => router.push("/events")}
          className="text-blue-600 hover:underline mb-4"
        >
          ← Volver a eventos
        </button>

        {loading ? (
          <div className="bg-white p-6 rounded-lg shadow-sm">
            Cargando evento...
          </div>
        ) : error ? (
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <div className="text-red-600 font-medium">{error}</div>
          </div>
        ) : (
          <>
            <div className="bg-white p-6 rounded-lg shadow-sm mb-6">
              <h1 className="text-3xl font-bold">{safeString(event?.name)}</h1>
              <p className="text-gray-600 mt-1">{locationText}</p>
            </div>

            <h2 className="text-xl font-semibold mb-3">Entradas disponibles</h2>

            {tickets.length === 0 ? (
              <div className="bg-white p-6 rounded-lg shadow-sm text-gray-600">
                No hay entradas disponibles por ahora.
              </div>
            ) : (
              <div className="space-y-3">
                {tickets.map((t) => (
                  <TicketCard key={t.id} ticket={t} onBuy={() => handleBuy(t.id)} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function TicketCard({ ticket, onBuy }) {
  const sellerName = ticket?.seller?.username || "Vendedor";
  const sellerRep = Number(ticket?.seller?.reputation ?? 0);

  return (
    <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-100 flex items-center justify-between">
      <div>
        <div className="text-lg font-semibold">{formatCurrencyCLP(ticket.price)}</div>
        <div className="text-sm text-gray-600">
          Ubicación:{" "}
          {ticket.section || ticket.row || ticket.seat
            ? `${safeString(ticket.section, "-")} / ${safeString(ticket.row, "-")} / ${safeString(ticket.seat, "-")}`
            : "—"}
        </div>
        <div className="text-sm text-gray-600 mt-1">
          Vendedor: <span className="font-medium text-gray-800">{sellerName}</span>
          <span className="ml-2 text-gray-500">({sellerRep.toFixed(1)}/5)</span>
        </div>
      </div>

      <button
        onClick={onBuy}
        className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-md font-medium"
      >
        Comprar
      </button>
    </div>
  );
}

