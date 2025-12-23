// app/events/page.jsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "../lib/supabaseClient";

function norm(str) {
  return (str || "")
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function formatEventDate(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat("es-CL", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  } catch {
    return "";
  }
}

// Normaliza filas del table events, por si cambian nombres de columnas
function normalizeEventRow(e) {
  return {
    id: e.id ?? e.event_id ?? e.uuid ?? e.slug,
    title: e.title ?? e.name ?? e.event_name ?? e.nombre ?? "Evento",
    starts_at: e.starts_at ?? e.start_at ?? e.date ?? e.start_date ?? e.fecha ?? null,
    venue: e.venue ?? e.place ?? e.location ?? e.venue_name ?? e.lugar ?? null,
    city: e.city ?? e.ciudad ?? null,
  };
}

export default function EventsPage() {
  const router = useRouter();
  const pathname = usePathname();

  const [events, setEvents] = useState([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  // auth (si no está logueado -> login)
  useEffect(() => {
    let alive = true;

    async function ensureAuth() {
      try {
        const { data } = await supabase.auth.getUser();
        if (!data?.user) {
          router.push(`/login?redirect=${encodeURIComponent(pathname || "/events")}`);
        }
      } catch {
        router.push(`/login?redirect=${encodeURIComponent(pathname || "/events")}`);
      }
    }

    ensureAuth();
    return () => {
      alive = false;
    };
  }, [router, pathname]);

  // load events
  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);

      const { data, error } = await supabase.from("events").select("*").limit(300);

      if (!alive) return;

      if (error) {
        console.error("[events] load error:", error);
        setEvents([]);
        setLoading(false);
        return;
      }

      const normalized = (data || []).map(normalizeEventRow);

      // Ordena por fecha si existe
      normalized.sort((a, b) => {
        const ta = a.starts_at ? new Date(a.starts_at).getTime() : 0;
        const tb = b.starts_at ? new Date(b.starts_at).getTime() : 0;
        return ta - tb;
      });

      setEvents(normalized);
      setLoading(false);
    }

    load();
    return () => {
      alive = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = norm(query);
    if (!q) return events;

    return events.filter((e) => {
      const blob = norm(
        [e.title, e.venue, e.city, formatEventDate(e.starts_at)].filter(Boolean).join(" ")
      );
      return blob.includes(q);
    });
  }, [events, query]);

  return (
    <div className="tix-section">
      <div className="tix-container">
        <div className="tix-card p-8">
          {/* ✅ LINK estilo texto arriba (como tu recuadro rojo) */}
          <Link href="/" className="text-sm text-slate-600 hover:text-blue-600">
            ← Volver al inicio
          </Link>

          <div className="mt-2 flex items-start justify-between gap-6">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Eventos disponibles</h1>
              <p className="mt-2 text-slate-600">
                Elige un evento para ver las entradas publicadas por otros usuarios.
              </p>
            </div>

            <Link
              href="/sell"
              className="rounded-full bg-green-600 px-6 py-3 text-white font-semibold hover:bg-green-700 transition"
            >
              Publicar entrada
            </Link>
          </div>

          {/* Search */}
          <div className="mt-8">
            <input
              className="tix-input"
              placeholder="Buscar evento (artista, recinto, ciudad...)"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          {/* Grid */}
          <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
            {loading ? (
              <div className="text-slate-600">Cargando eventos...</div>
            ) : filtered.length === 0 ? (
              <div className="text-slate-600">No encontramos eventos con ese texto.</div>
            ) : (
              filtered.map((ev) => {
                const date = formatEventDate(ev.starts_at);
                const meta = [date, ev.venue, ev.city].filter(Boolean).join(" · ");

                return (
                  <div key={ev.id} className="rounded-2xl border border-slate-200 bg-white p-6">
                    <div className="text-xl font-bold text-slate-900">{ev.title}</div>

                    <div className="mt-3 space-y-2 text-slate-700">
                      {date ? (
                        <div className="flex items-center gap-2">
                          <span>📅</span>
                          <span>{date}</span>
                        </div>
                      ) : null}

                      {(ev.venue || ev.city) ? (
                        <div className="flex items-center gap-2">
                          <span>📍</span>
                          <span>{[ev.venue, ev.city].filter(Boolean).join(" · ")}</span>
                        </div>
                      ) : null}
                    </div>

                    <Link
                      href={`/events/${ev.id}`}
                      className="mt-5 inline-flex items-center gap-2 font-semibold text-blue-600 hover:text-blue-700"
                    >
                      Ver entradas disponibles <span aria-hidden>→</span>
                    </Link>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
