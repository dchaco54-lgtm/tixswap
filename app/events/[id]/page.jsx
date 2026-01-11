// app/events/[id]/page.jsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import supabase from "../../lib/supabaseClient";

const AVAILABLE_TICKET_STATUSES = new Set([
  "active",
  "available",
  "listed",
  "published",
]);

function normalizeTicket(t) {
  const status = (t?.status ?? "").toString().toLowerCase();

  return {
    ...t,
    // compat nombres antiguos
    sector: t?.sector ?? t?.section ?? null,
    row_label: t?.row_label ?? t?.row ?? t?.fila ?? null,
    seat_label: t?.seat_label ?? t?.seat ?? t?.asiento ?? null,
    _statusNorm: status,
  };
}

function normalizeEvent(e) {
  return {
    ...e,
    // compat
    title_norm: e?.title ?? e?.name ?? "Evento",
    starts_at_norm: e?.starts_at ?? e?.date ?? null,
  };
}

function formatCLP(value) {
  const n = Number(value ?? 0);
  if (Number.isNaN(n)) return "$0";
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(n);
}

function formatDateCL(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("es-CL", {
    year: "numeric",
    month: "long",
    day: "2-digit",
  }).format(d);
}

export default function EventDetailPage({ params }) {
  const router = useRouter();
  const { id } = params;

  const [event, setEvent] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [profilesById, setProfilesById] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError("");

        // 1) evento (select * para no romper si cambian columnas)
        const { data: eventData, error: eventError } = await supabase
          .from("events")
          .select("*")
          .eq("id", id)
          .single();

        if (eventError) throw eventError;

        const e = normalizeEvent(eventData);
        if (!cancelled) setEvent(e);

        // 2) tickets del evento (select * para evitar mismatch de columnas)
        const { data: ticketsData, error: ticketsError } = await supabase
          .from("tickets")
          .select("*")
          .eq("event_id", id)
          .order("created_at", { ascending: false });

        if (ticketsError) throw ticketsError;

        const normalized = (ticketsData || []).map(normalizeTicket);
        const visible = normalized.filter((t) => {
          if (!t._statusNorm) return true; // si no hay status, igual mostrar
          return AVAILABLE_TICKET_STATUSES.has(t._statusNorm);
        });

        if (!cancelled) setTickets(visible);

        // 3) perfiles vendedores (si existe RLS y falla, no mata la página)
        const sellerIds = Array.from(
          new Set(visible.map((t) => t.seller_id).filter(Boolean))
        );

        if (sellerIds.length > 0) {
          const { data: profilesData, error: profilesError } = await supabase
            .from("profiles")
            .select("id,username,full_name,reputation")
            .in("id", sellerIds);

          if (!profilesError && profilesData) {
            const map = {};
            for (const p of profilesData) map[p.id] = p;
            if (!cancelled) setProfilesById(map);
          }
        }
      } catch (err) {
        console.error("EventDetailPage load error:", err);
        if (!cancelled) setError("No pudimos cargar las entradas en este momento.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    if (id) load();

    return () => {
      cancelled = true;
    };
  }, [id]);

  const eventTitle = event?.title_norm ?? "Evento";
  const eventWhen = formatDateCL(event?.starts_at_norm);
  const eventWhere = [event?.city, event?.venue].filter(Boolean).join(" • ");

  const sortedTickets = useMemo(() => {
    // orden por precio (sube) si hay price
    return [...tickets].sort((a, b) => (a.price ?? 0) - (b.price ?? 0));
  }, [tickets]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <main className="max-w-5xl mx-auto px-4 py-10">
          <p className="text-gray-600">Cargando entradas...</p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="max-w-5xl mx-auto px-4 py-10">
        <div className="mb-6">
          <Link href="/events" className="text-blue-600 hover:underline">
            ← Volver a eventos
          </Link>
        </div>

        <div className="bg-white rounded-2xl shadow p-6 mb-8">
          <h1 className="text-3xl font-bold mb-2">{eventTitle}</h1>

          <div className="text-gray-600">
            {eventWhere && <div>{eventWhere}</div>}
            {eventWhen && <div>{eventWhen}</div>}
          </div>
        </div>

        <h2 className="text-xl font-semibold mb-4">Entradas disponibles</h2>

        {error ? (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4">
            {error}
          </div>
        ) : sortedTickets.length === 0 ? (
          <div className="bg-white rounded-2xl shadow p-6 text-gray-600">
            No hay entradas disponibles por ahora.
          </div>
        ) : (
          <div className="grid gap-4">
            {sortedTickets.map((t) => {
              const sellerProfile = t.seller_id ? profilesById[t.seller_id] : null;
              return (
                <TicketCard
                  key={t.id}
                  ticket={t}
                  sellerProfile={sellerProfile}
                  onBuy={() => router.push(`/checkout/${t.id}`)}
                />
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

function Header() {
  return (
    <header className="bg-white border-b">
      <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
        <Link href="/" className="text-xl font-bold text-blue-600">
          TixSwap
        </Link>
        <nav className="flex items-center gap-6 text-gray-700">
          <Link href="/events" className="hover:text-blue-600">
            Comprar
          </Link>
          <Link href="/sell" className="hover:text-blue-600">
            Vender
          </Link>
          <Link href="/how" className="hover:text-blue-600">
            Cómo funciona
          </Link>
        </nav>
      </div>
    </header>
  );
}

function TicketCard({ ticket, sellerProfile, onBuy }) {
  const sellerName =
    sellerProfile?.full_name ||
    sellerProfile?.username ||
    ticket?.seller_name ||
    "Vendedor";

  const reputation = sellerProfile?.reputation ?? null;

  const meta = [
    ticket?.sector ? `Sector: ${ticket.sector}` : null,
    ticket?.row_label ? `Fila: ${ticket.row_label}` : null,
    ticket?.seat_label ? `Asiento: ${ticket.seat_label}` : null,
  ].filter(Boolean);

  return (
    <div className="bg-white rounded-2xl shadow p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
      <div>
        <div className="flex items-center gap-2 mb-2">
          <div className="font-semibold">{sellerName}</div>
          {reputation !== null ? (
            <div className="text-sm text-gray-600">★ {Number(reputation).toFixed(1)}</div>
          ) : (
            <div className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600">
              Vendedor nuevo
            </div>
          )}
        </div>

        {ticket?.title && <div className="text-gray-900 mb-1">{ticket.title}</div>}
        {meta.length > 0 && <div className="text-gray-600 text-sm">{meta.join(" • ")}</div>}
      </div>

      <div className="flex items-center gap-4">
        <div className="text-2xl font-bold">{formatCLP(ticket?.price)}</div>
        <button
          onClick={onBuy}
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 py-2 rounded-xl"
        >
          Comprar
        </button>
      </div>
    </div>
  );
}



