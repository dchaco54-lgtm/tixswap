"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import TicketCard from "./TicketCard";

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
  const [sellerMap, setSellerMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!id) return;

    const load = async () => {
      try {
        setLoading(true);
        setErrorMsg("");

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

        // 3) Vendedores (best-effort, si falla no bloquea)
        const sellerIds = Array.from(
          new Set(list.map((t) => t?.seller_id).filter(Boolean))
        );

        if (sellerIds.length) {
          const { data: profs, error: profErr } = await supabase
            .from("profiles")
            .select("id, full_name, email")
            .in("id", sellerIds);

          if (!profErr && Array.isArray(profs)) {
            const map = {};
            for (const p of profs) map[p.id] = p;
            setSellerMap(map);
          }
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

      {/* Advertencias/Recomendaciones - Compacto */}
      <div className="mt-3 p-2.5 rounded-lg bg-blue-50 border border-blue-200">
        <div className="flex items-start gap-2">
          <span className="text-base flex-shrink-0">🛡️</span>
          <p className="text-xs text-blue-900 leading-snug whitespace-pre-line">
            {displayWarnings}
          </p>
        </div>
      </div>

      <h2 className="text-2xl font-semibold mt-10 mb-4">Entradas disponibles</h2>

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
            <TicketCard key={t.id} ticket={t} seller={sellerMap[t.seller_id]} />
          ))}
        </div>
      )}
    </div>
  );
}
