"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

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

function formatCLP(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "";
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(n);
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

        // 1) Evento (server API)
        const evRes = await fetch(`/api/events/${id}`, { cache: "no-store" });
        const evJson = await evRes.json().catch(() => ({}));
        if (!evRes.ok) {
          throw new Error(evJson?.details || evJson?.error || "No pudimos cargar el evento.");
        }
        setEvent(evJson.event || null);

        // 2) Tickets (server API)
        const tRes = await fetch(`/api/events/${id}/tickets`, { cache: "no-store" });
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
      <button 
        onClick={() => window.history.back()} 
        className="text-blue-600 hover:underline text-sm mb-3"
      >
        ← Volver a eventos
      </button>

      {/* Card del evento con imagen incluida */}
      <div className="rounded-2xl border bg-white overflow-hidden shadow-sm">
        {/* Imagen del evento */}
        {imageUrl && (
          <div className="w-full">
            <img 
              src={imageUrl} 
              alt={title}
              className="w-full h-48 md:h-64 object-cover"
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

function TicketCard({ ticket, seller }) {
  const [session, setSession] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data?.session);
    });
  }, []);

  const handleBuyClick = (e) => {
    if (!session) {
      e.preventDefault();
      window.location.href = '/login?redirect=/checkout/' + ticket.id;
    }
  };

  const price =
    ticket?.price ||
    ticket?.price_clp ||
    ticket?.amount ||
    ticket?.total_paid_clp ||
    ticket?.total ||
    null;

  const section = ticket?.section || ticket?.sector || "";
  const row = ticket?.row || ticket?.fila || "";
  const seat = ticket?.seat || ticket?.asiento || "";

  const sellerName = seller?.full_name || seller?.email || "Vendedor";

  return (
    <div className="p-5 rounded-2xl border bg-white">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-lg font-semibold">
            {section ? `Sección ${section}` : "Entrada"}
          </div>
          <div className="text-gray-600 mt-1">
            {[row && `Fila ${row}`, seat && `Asiento ${seat}`].filter(Boolean).join(" · ")}
          </div>
          <div className="text-gray-600 mt-2">Vende: {sellerName}</div>
        </div>

        <div className="text-right">
          <div className="text-xl font-bold">{price ? formatCLP(price) : "-"}</div>
          <Link
            href={`/checkout/${ticket.id}`}
            onClick={handleBuyClick}
            className="inline-block mt-3 px-4 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700"
          >
            Comprar
          </Link>
        </div>
      </div>
    </div>
  );
}
