"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import StarRating from "@/components/StarRating";

function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("es-CL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
}

function buildEventLine(event) {
  if (!event) return "";
  return [event.city, event.venue, event.starts_at ? formatDate(event.starts_at) : null]
    .filter(Boolean)
    .join(" · ");
}

function buildSeatLine(ticket) {
  if (!ticket) return "";
  const section = ticket.section_label || ticket.sector || "";
  const row = ticket.row_label || "";
  const seat = ticket.seat_label || "";
  return [
    section ? `Sector ${section}` : null,
    row ? `Fila ${row}` : null,
    seat ? `Asiento ${seat}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

export default function MisCalificacionesPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");
      try {
        const res = await fetch("/api/ratings/my", { cache: "no-store" });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.error || "Error cargando calificaciones");
        if (!cancelled) setData(json);
      } catch (e) {
        if (!cancelled) setError(e?.message || "No se pudieron cargar tus calificaciones");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const asSeller = useMemo(() => data?.as_seller || { average: 0, count: 0, ratings: [] }, [data]);
  const asBuyer = useMemo(() => data?.as_buyer || { average: 0, count: 0, ratings: [] }, [data]);

  const renderSection = (title, block, type) => {
    const list = block?.ratings || [];
    const avg = Number(block?.average || 0);
    const count = Number(block?.count || 0);

    return (
      <div className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold">{title}</h2>
            <div className="text-xs text-slate-500">
              Promedio y comentarios recibidos
            </div>
          </div>
          {count > 0 ? (
            <StarRating
              value={avg}
              text={`${avg.toFixed(1)} · ${count} calificacion${count === 1 ? "" : "es"}`}
              size={16}
            />
          ) : (
            <span className="text-xs text-slate-400">Sin calificaciones</span>
          )}
        </div>

        {count === 0 ? (
          <div className="text-sm text-slate-500">
            Aún no tienes calificaciones {type}.
          </div>
        ) : (
          <div className="grid gap-4">
            {list.map((r) => {
              const event = r.event;
              const ticket = r.ticket;
              const eventLine = buildEventLine(event);
              const seatLine = buildSeatLine(ticket);
              const href =
                type === "como vendedor"
                  ? ticket?.id
                    ? `/dashboard/publications/${ticket.id}`
                    : "#"
                  : r.order?.id
                  ? `/dashboard/purchases/${r.order.id}`
                  : "#";

              return (
                <div key={r.id} className="rounded-2xl border bg-white p-4 shadow-sm">
                  <div className="flex gap-4">
                    <div className="w-24 h-24 rounded-xl overflow-hidden bg-slate-100 shrink-0">
                      {event?.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={event.image_url}
                          alt={event?.title || "Evento"}
                          className="w-full h-full object-cover"
                        />
                      ) : null}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="text-lg font-semibold truncate">
                        {event?.title || "Evento"}
                      </div>
                      <div className="text-sm text-slate-600">
                        {eventLine || "—"}
                      </div>
                      <div className="text-sm text-slate-600 mt-1">
                        {seatLine || "Sector · Fila · Asiento"}
                      </div>

                      <div className="mt-2 flex items-center gap-2">
                        <StarRating value={Number(r.stars || 0)} text={`${r.stars}/5`} size={14} />
                        <span className="text-xs text-slate-500">
                          {formatDate(r.created_at)}
                        </span>
                      </div>
                      <div className="mt-2 text-sm text-slate-600">
                        {r.comment || "Sin comentario"}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <Link
                        href={href}
                        className={`inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm ${
                          href === "#"
                            ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                            : "bg-blue-600 text-white hover:bg-blue-700"
                        }`}
                      >
                        Ver más →
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Mis calificaciones</h1>
        <Link
          href="/dashboard/soporte"
          className="text-sm text-slate-600 hover:underline"
        >
          ¿Disconforme? Levanta un ticket en Soporte
        </Link>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 text-red-700 p-4 mb-6">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="grid gap-4">
          <div className="h-28 rounded-2xl border animate-pulse" />
          <div className="h-28 rounded-2xl border animate-pulse" />
        </div>
      ) : (
        <div className="grid gap-6">
          {renderSection("Como vendedor", asSeller, "como vendedor")}
          {renderSection("Como comprador", asBuyer, "como comprador")}
        </div>
      )}
    </div>
  );
}
