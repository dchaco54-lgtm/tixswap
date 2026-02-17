"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import TicketCard from "./TicketCard";
import EventAlertButton from "@/app/components/EventAlertButton";

function formatDateCL(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("es-CL", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "2-digit",
  }).format(d);
}

function formatTimeCL(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("es-CL", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export default function EventDetailPage() {
  const params = useParams();
  const id = params?.id;

  const [event, setEvent] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [changeLogs, setChangeLogs] = useState([]);
  const [hasRecentChange, setHasRecentChange] = useState(false);
  const [showChanges, setShowChanges] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!id) return;

    const load = async () => {
      try {
        setLoading(true);
        setErrorMsg("");
        setChangeLogs([]);
        setHasRecentChange(false);
        setShowChanges(false);

        // Cache busting: timestamp + headers anti-caché
        const timestamp = Date.now();
        const cacheHeaders = {
          'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
          'Pragma': 'no-cache',
          'Expires': '0'
        };

        // 1) Evento (server API)
        const evRes = await fetch(`/api/events/${id}?_t=${timestamp}`, { 
          cache: "no-store",
          headers: cacheHeaders
        });
        const evJson = await evRes.json().catch(() => ({}));
        if (!evRes.ok) {
          throw new Error(evJson?.details || evJson?.error || "No pudimos cargar el evento.");
        }
        setEvent(evJson.event || null);

        // 2) Tickets (server API)
        const tRes = await fetch(`/api/events/${id}/tickets?_t=${timestamp}`, { 
          cache: "no-store",
          headers: cacheHeaders
        });
        const tJson = await tRes.json().catch(() => ({}));
        if (!tRes.ok) {
          throw new Error(tJson?.details || tJson?.error || "No pudimos cargar las entradas en este momento.");
        }

        const list = Array.isArray(tJson.tickets) ? tJson.tickets : [];
        setTickets(list);

        // 3) Cambios recientes (sin bloquear la vista)
        try {
          const cRes = await fetch(`/api/events/${id}/changes?_t=${timestamp}`, {
            cache: "no-store",
            headers: cacheHeaders,
          });
          const cJson = await cRes.json().catch(() => ({}));
          if (cRes.ok) {
            const logs = Array.isArray(cJson.logs) ? cJson.logs : [];
            setChangeLogs(logs);
            setHasRecentChange(Boolean(cJson?.hasRecent));
          }
        } catch (changeErr) {
          console.warn("[EventDetail] changes error:", changeErr);
        }

      } catch (e) {
        console.error(e);
        setErrorMsg(e?.message || "Ocurrió un error cargando el evento.");
        setEvent(null);
        setTickets([]);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [id]);

  const title = useMemo(() => {
    return event?.title || event?.name || "Evento";
  }, [event]);

  const subtitle = useMemo(() => {
    const date = event?.starts_at ? formatDateCL(event.starts_at) : "";
    const time = event?.starts_at ? formatTimeCL(event.starts_at) : "";
    const place = [event?.venue, event?.city].filter(Boolean).join(", ");
    return [date && time ? `${date} · ${time}` : (date || time), place]
      .filter(Boolean)
      .join(" · ");
  }, [event]);

  const imageUrl = event?.image_url || event?.poster_url || event?.cover_image || null;
  const warnings = event?.warnings || event?.recommendations || event?.alerts || null;
  const latestChange = changeLogs[0] || null;

  const FIELD_LABELS = {
    title: "Nombre del evento",
    starts_at: "Fecha y hora",
    venue: "Recinto",
    city: "Ciudad",
    image_url: "Imagen/banner",
  };

  function formatChangeValue(field, value) {
    if (field === "starts_at") return value ? `${formatDateCL(value)} · ${formatTimeCL(value)}` : "—";
    return value || "—";
  }

  // Advertencias genéricas por defecto de TixSwap
  const defaultWarnings = `🔒 No hagas transacciones fuera de la plataforma
⚠️ Recuerda: no entregues tus datos personales antes de confirmar
🛡️ Evita estafas - no compartas tus claves ni PIN
📄 Siempre pide el PDF de la entrada al vendedor`;

  const displayWarnings = warnings || defaultWarnings;

  return (
    <div className="max-w-5xl mx-auto px-4 py-4">
      <Link 
        href="/events" 
        className="text-blue-600 hover:underline text-sm mb-3 inline-block"
      >
        ← Volver a eventos
      </Link>

      {/* Card del evento con imagen incluida */}
      <div className="rounded-2xl border bg-white overflow-hidden shadow-sm">
        {/* Imagen del evento tipo banner */}
        {imageUrl && (
          <div className="w-full">
            <img 
              src={imageUrl} 
              alt={title}
              className="w-full h-20 md:h-24 object-cover"
            />
          </div>
        )}
        
        {/* Información del evento */}
        <div className="p-4">
          <h1 className="text-xl md:text-2xl font-bold">{title}</h1>
          {subtitle && <div className="text-gray-600 mt-1 text-sm">{subtitle}</div>}
        </div>
      </div>

      {hasRecentChange && (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="text-sm text-amber-900 font-semibold">
            Evento actualizado recientemente.
          </div>
          <button
            onClick={() => setShowChanges(true)}
            className="text-sm font-semibold text-amber-900 underline"
          >
            Ver cambios
          </button>
        </div>
      )}

      {/* Advertencias/Recomendaciones - Compacto */}
      <div className="mt-3 p-2.5 rounded-lg bg-blue-50 border border-blue-200">
        <div className="flex items-start gap-2">
          <span className="text-base flex-shrink-0">🛡️</span>
          <p className="text-xs text-blue-900 leading-snug whitespace-pre-line">
            {displayWarnings}
          </p>
        </div>
      </div>

      <div className="mt-10 mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <h2 className="text-2xl font-semibold">Entradas disponibles</h2>
        <EventAlertButton eventId={id} eventName={title} />
      </div>

      {loading && <div className="text-gray-600">Cargando entradas...</div>}

      {!loading && errorMsg && (
        <div className="p-4 rounded-lg border border-red-200 bg-red-50 text-red-700">
          {errorMsg}
        </div>
      )}

      {!loading && !errorMsg && tickets.length === 0 && (
        <div className="text-gray-600">Aún no hay entradas publicadas para este evento.</div>
      )}

      {!loading && !errorMsg && tickets.length > 0 && (
        <div className="grid md:grid-cols-2 gap-6">
          {tickets.map((t) => (
            <TicketCard key={t.id} ticket={t} />
          ))}
        </div>
      )}

      {showChanges && latestChange && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-bold">Evento actualizado</h3>
                <p className="text-sm text-slate-500 mt-1">
                  {latestChange?.created_at
                    ? new Date(latestChange.created_at).toLocaleString("es-CL", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })
                    : ""}
                </p>
              </div>
              <button
                onClick={() => setShowChanges(false)}
                className="text-slate-500 hover:text-slate-700"
              >
                Cerrar
              </button>
            </div>

            <div className="mt-4 space-y-3">
              {(latestChange?.changed_fields || []).map((field) => (
                <div key={field} className="rounded-xl border border-slate-200 p-3">
                  <div className="text-sm font-semibold text-slate-800">
                    {FIELD_LABELS[field] || field}
                  </div>
                  <div className="grid md:grid-cols-2 gap-3 mt-2 text-sm">
                    <div className="rounded-lg bg-slate-50 px-3 py-2 text-slate-600">
                      <div className="text-xs uppercase text-slate-400">Antes</div>
                      <div className="font-medium text-slate-700">
                        {formatChangeValue(field, latestChange?.old_values?.[field])}
                      </div>
                    </div>
                    <div className="rounded-lg bg-emerald-50 px-3 py-2 text-emerald-700">
                      <div className="text-xs uppercase text-emerald-400">Después</div>
                      <div className="font-semibold text-emerald-700">
                        {formatChangeValue(field, latestChange?.new_values?.[field])}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {latestChange?.message_to_users && (
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 whitespace-pre-line">
                {latestChange.message_to_users}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
