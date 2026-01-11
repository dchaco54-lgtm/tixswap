"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { supabase } from "@/lib/supabaseClient";
import { normalizeEventRow } from "@/app/lib/events";
import { formatCLP, formatDateLongCL } from "@/app/lib/format";

function Stars({ value = 0 }) {
  const v = Math.max(0, Math.min(5, Number(value || 0)));
  const full = Math.floor(v);
  const half = v - full >= 0.5 ? 1 : 0;
  const empty = 5 - full - half;

  return (
    <span className="inline-flex items-center gap-0.5">
      {Array.from({ length: full }).map((_, i) => (
        <span key={`f-${i}`} className="text-yellow-500">★</span>
      ))}
      {half ? <span className="text-yellow-500">☆</span> : null}
      {Array.from({ length: empty }).map((_, i) => (
        <span key={`e-${i}`} className="text-gray-300">★</span>
      ))}
    </span>
  );
}

function TicketCard({ ticket, onBuy }) {
  const seatLine = useMemo(() => {
    const parts = [];
    if (ticket?.sector) parts.push(`Sector: ${ticket.sector}`);
    if (ticket?.row_label) parts.push(`Fila: ${ticket.row_label}`);
    if (ticket?.seat_label) parts.push(`Asiento: ${ticket.seat_label}`);
    return parts.length ? parts.join(" • ") : "Ubicación: — / — / —";
  }, [ticket]);

  return (
    <div className="border rounded-xl bg-white p-5 flex flex-col gap-2 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-2xl font-semibold">{formatCLP(ticket?.price)}</div>
          <div className="text-gray-600">{seatLine}</div>
          <div className="text-gray-500 text-sm mt-2">
            Vendedor:{" "}
            <span className="text-gray-800 font-medium">
              {ticket?.seller?.name || ticket?.seller?.email || "Vendedor"}
            </span>{" "}
            {ticket?.seller?.rating != null ? (
              <span className="ml-2 inline-flex items-center gap-1 text-gray-500">
                <Stars value={ticket.seller.rating} />
                <span className="text-xs">
                  ({ticket.seller.ratingCount || 0})
                </span>
              </span>
            ) : null}
          </div>
        </div>

        <button
          onClick={onBuy}
          className="px-6 py-2 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 transition"
        >
          Comprar
        </button>
      </div>
    </div>
  );
}

export default function EventDetailPage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params?.id;

  const [event, setEvent] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!eventId) return;
    let alive = true;

    async function load() {
      try {
        setLoading(true);
        setErrorMsg("");

        // ✅ EVENT REAL
        const { data: eventRow, error: eventError } = await supabase
          .from("events")
          .select("id, title, venue, city, starts_at, image_url")
          .eq("id", eventId)
          .maybeSingle();

        if (eventError) throw eventError;
        if (!eventRow) throw new Error("Evento no encontrado");

        const eventNorm = normalizeEventRow(eventRow);

        // ✅ TICKETS REAL
        const { data: ticketRows, error: ticketError } = await supabase
          .from("tickets")
          .select("id, event_id, seller_id, sector, row_label, seat_label, price, status, created_at")
          .eq("event_id", eventId)
          .eq("status", "active")
          .order("created_at", { ascending: false });

        if (ticketError) throw ticketError;

        const rows = ticketRows || [];
        const sellerIds = Array.from(
          new Set(rows.map((t) => t.seller_id).filter(Boolean))
        );

        // perfiles
        let sellerMap = {};
        if (sellerIds.length) {
          const { data: sellers } = await supabase
            .from("profiles")
            .select("id, full_name, email")
            .in("id", sellerIds);

          (sellers || []).forEach((s) => {
            sellerMap[s.id] = {
              id: s.id,
              name: s.full_name || null,
              email: s.email || null,
            };
          });
        }

        // rating vendedores (si existe)
        let ratingMap = {};
        if (sellerIds.length) {
          const { data: ratings } = await supabase
            .from("ratings")
            .select("target_id, stars, role")
            .in("target_id", sellerIds)
            .eq("role", "seller");

          const grouped = {};
          (ratings || []).forEach((r) => {
            grouped[r.target_id] = grouped[r.target_id] || [];
            grouped[r.target_id].push(Number(r.stars || 0));
          });

          Object.entries(grouped).forEach(([id, arr]) => {
            const avg = arr.reduce((a, b) => a + b, 0) / arr.length;
            ratingMap[id] = { avg: Number(avg.toFixed(1)), count: arr.length };
          });
        }

        const withSeller = rows.map((t) => {
          const s = sellerMap[t.seller_id] || {};
          const r = ratingMap[t.seller_id] || null;
          return {
            ...t,
            seller: {
              ...s,
              rating: r ? r.avg : null,
              ratingCount: r ? r.count : 0,
            },
          };
        });

        if (!alive) return;
        setEvent(eventNorm);
        setTickets(withSeller);
      } catch (err) {
        console.error(err);
        if (!alive) return;
        setErrorMsg("No pudimos cargar las entradas en este momento.");
      } finally {
        if (alive) setLoading(false);
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, [eventId]);

  return (
    <main className="max-w-4xl mx-auto px-6 py-10">
      <div className="mb-6">
        <Link href="/events" className="text-blue-600 hover:underline">
          ← Volver a eventos
        </Link>
      </div>

      {event ? (
        <div className="mb-8">
          <h1 className="text-4xl font-bold">{event.title}</h1>
          <div className="text-gray-600 mt-1">
            {event.city ? `${event.city} · ` : ""}{event.venue || ""}{" "}
            {event.startsAt ? `· ${formatDateLongCL(event.startsAt)}` : ""}
          </div>
        </div>
      ) : null}

      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-semibold">Entradas disponibles</h2>
        <button
          className="px-5 py-2 rounded-lg bg-green-600 text-white font-semibold hover:bg-green-700"
          onClick={() => router.push("/sell")}
        >
          Publicar entrada
        </button>
      </div>

      {loading ? (
        <div className="p-6 bg-white rounded-xl border">Cargando…</div>
      ) : errorMsg ? (
        <div className="p-6 bg-white rounded-xl border text-red-600">{errorMsg}</div>
      ) : tickets.length === 0 ? (
        <div className="p-6 bg-white rounded-xl border text-gray-600">
          No hay entradas disponibles por ahora.
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {tickets.map((t) => (
            <TicketCard
              key={t.id}
              ticket={t}
              onBuy={() => router.push(`/checkout/${t.id}`)}
            />
          ))}
        </div>
      )}
    </main>
  );
}


