// app/events/page.jsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

function formatDateCL(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("es-CL", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(d);
}

export default function EventsPage() {
  const router = useRouter();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  // Página pública - SIN guard de sesión

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setErrorMsg("");

        console.log('[Events] Cargando eventos...');
        const res = await fetch("/api/events", { cache: "no-store" });
        const json = await res.json().catch(() => ({}));

        console.log('[Events] Response:', { ok: res.ok, status: res.status, eventsCount: json?.events?.length });

        if (!res.ok) {
          throw new Error(json?.details || json?.error || "No se pudieron cargar los eventos.");
        }

        setEvents(Array.isArray(json.events) ? json.events : []);
      } catch (e) {
        console.error('[Events] Error:', e);
        setErrorMsg(e?.message || "No se pudieron cargar los eventos.");
        setEvents([]);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const hasEvents = useMemo(() => events.length > 0, [events]);

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold mb-6">Eventos</h1>

      {loading && (
        <div className="text-gray-600">Cargando eventos...</div>
      )}

      {!loading && errorMsg && (
        <div className="p-4 rounded-lg border border-red-200 bg-red-50 text-red-700">
          {errorMsg}
        </div>
      )}

      {!loading && !errorMsg && !hasEvents && (
        <div className="text-gray-600">No hay eventos disponibles.</div>
      )}

      {!loading && !errorMsg && hasEvents && (
        <div className="grid md:grid-cols-2 gap-6">
          {events.map((ev) => {
            const title = ev?.title || ev?.name || "Evento";
            const date = ev?.starts_at ? formatDateCL(ev.starts_at) : "";
            const city = ev?.city || "";
            const venue = ev?.venue || "";
            return (
              <Link
                key={ev.id}
                href={`/events/${ev.id}`}
                className="block p-5 rounded-2xl border bg-white hover:shadow-md transition"
              >
                <div className="text-xl font-semibold">{title}</div>
                <div className="text-gray-600 mt-1">
                  {date ? `${date}` : ""}
                  {date && (city || venue) ? " · " : ""}
                  {[venue, city].filter(Boolean).join(", ")}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

