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
    return String(iso);
  }
}

// ✅ Orden global: próximos primero (más cercanos), luego lejanos, al final pasados
function sortEventsByProximity(list = []) {
  const now = Date.now();
  const arr = Array.isArray(list) ? [...list] : [];

  arr.sort((a, b) => {
    const ta = a?.starts_at ? new Date(a.starts_at).getTime() : null;
    const tb = b?.starts_at ? new Date(b.starts_at).getTime() : null;

    const aMissing = !ta || Number.isNaN(ta);
    const bMissing = !tb || Number.isNaN(tb);
    if (aMissing && bMissing) return 0;
    if (aMissing) return 1; // sin fecha al final
    if (bMissing) return -1;

    const aFuture = ta >= now;
    const bFuture = tb >= now;

    if (aFuture && !bFuture) return -1; // futuros primero
    if (!aFuture && bFuture) return 1;

    // ambos futuros: asc (más cercano primero)
    if (aFuture && bFuture) return ta - tb;

    // ambos pasados: desc (más reciente pasado primero)
    return tb - ta;
  });

  return arr;
}

export default function EventsPage() {
  const router = useRouter();
  const pathname = usePathname();

  const [userChecked, setUserChecked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState([]);
  const [query, setQuery] = useState("");

  // Auth guard: si no hay sesión -> login y vuelve a /events
  useEffect(() => {
    const guard = async () => {
      const { data } = await supabase.auth.getUser();
      if (!data?.user) {
        router.replace(`/login?redirectTo=${encodeURIComponent(pathname || "/events")}`);
        return;
      }
      setUserChecked(true);
    };
    guard();
  }, [router, pathname]);

  useEffect(() => {
    if (!userChecked) return;

    const load = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .order("starts_at", { ascending: true, nullsFirst: false });

      if (!error) {
        const sorted = sortEventsByProximity(Array.isArray(data) ? data : []);
        setEvents(sorted);
      }
      setLoading(false);
    };

    load();
  }, [userChecked]);

  const filtered = useMemo(() => {
    const q = norm(query);
    if (!q) return events;

    return (events || []).filter((ev) => {
      const hay = norm(
        `${ev?.title || ev?.name || ""} ${ev?.venue || ev?.location || ""} ${ev?.city || ""}`
      );
      return hay.includes(q);
    });
  }, [query, events]);

  if (!userChecked) {
    return <div className="max-w-6xl mx-auto px-4 py-16 text-slate-600">Cargando…</div>;
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      <div className="flex items-center justify-between gap-4">
        <div>
          <Link href="/" className="text-sm text-slate-600 hover:text-blue-600">
            ← Volver al inicio
          </Link>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">Eventos disponibles</h1>
          <p className="mt-2 text-slate-600">
            Elige un evento para ver las entradas publicadas por otros usuarios.
          </p>
        </div>

        <button
          onClick={() => router.push("/sell")}
          className="bg-green-600 text-white px-5 py-2.5 rounded-full font-semibold hover:opacity-90"
        >
          Publicar entrada
        </button>
      </div>

      <div className="mt-8">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar evento (artista, recinto, ciudad...)"
          className="w-full border rounded-xl px-5 py-3 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
      </div>

      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
        {loading ? (
          <p className="text-slate-600">Cargando eventos…</p>
        ) : filtered.length === 0 ? (
          <p className="text-slate-600">No hay eventos que coincidan con tu búsqueda.</p>
        ) : (
          filtered.map((ev) => {
            const title = ev?.title || ev?.name || "Evento";
            const date = formatEventDate(ev?.starts_at || ev?.date);
            const venue = ev?.venue || ev?.location || "";
            const city = ev?.city || "";
            const imageUrl = (ev?.image_url || "").trim();

            return (
              <div key={ev.id} className="bg-white border rounded-xl p-6 shadow-sm">
                {/* ✅ Imagen (solo se agrega, no cambia lo demás) */}
                <div className="w-full h-40 rounded-xl bg-gray-100 overflow-hidden flex items-center justify-center mb-4">
                  {imageUrl ? (
                    <img
                      src={imageUrl}
                      alt={title}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <span className="text-sm text-gray-400">Falta cargar imagen</span>
                  )}
                </div>

                <h3 className="text-xl font-bold text-slate-900">{title}</h3>
                <div className="mt-3 text-slate-700 space-y-1">
                  {date && <p>📅 {date}</p>}
                  {(venue || city) && (
                    <p>
                      📍 {venue}
                      {venue && city ? " · " : ""}
                      {city}
                    </p>
                  )}
                </div>

                <Link
                  href={`/events/${ev.id}`}
                  className="mt-5 inline-block text-blue-600 font-semibold hover:underline"
                >
                  Ver entradas disponibles →
                </Link>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
