// app/events/page.jsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

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
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

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

  // Filtrar eventos: solo futuros/hoy + ordenar por fecha
  const activeEvents = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    // Filtrar solo eventos que NO han pasado (fecha >= hoy)
    const futureEvents = events.filter((ev) => {
      if (!ev?.starts_at) return true; // Si no tiene fecha, lo mostramos
      
      const eventDate = new Date(ev.starts_at);
      const eventDay = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate());
      
      // Mantener si es hoy o futuro
      return eventDay >= today;
    });
    
    // Ordenar por fecha: más próximo primero
    return futureEvents.sort((a, b) => {
      const dateA = a?.starts_at ? new Date(a.starts_at).getTime() : Infinity;
      const dateB = b?.starts_at ? new Date(b.starts_at).getTime() : Infinity;
      return dateA - dateB;
    });
  }, [events]);

  // Filtrar eventos basado en búsqueda
  const filteredEvents = useMemo(() => {
    if (!searchQuery.trim()) return activeEvents;
    
    const query = searchQuery.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    
    return activeEvents.filter((ev) => {
      const searchText = [
        ev?.title || ev?.name || "",
        ev?.venue || "",
        ev?.city || "",
      ].join(" ").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      
      return searchText.includes(query);
    });
  }, [activeEvents, searchQuery]);

  const hasEvents = useMemo(() => filteredEvents.length > 0, [filteredEvents]);

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      {/* Botón volver al inicio */}
      <div className="mb-6">
        <Link 
          href="/" 
          className="inline-flex items-center text-blue-600 hover:text-blue-700"
        >
          ← Volver al inicio
        </Link>
      </div>

      <h1 className="text-3xl font-bold mb-6">Eventos</h1>

      {/* Buscador */}
      <div className="mb-8">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Busca eventos, artistas, lugares..."
          className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {searchQuery && (
          <div className="mt-2 text-sm text-gray-600">
            {filteredEvents.length} {filteredEvents.length === 1 ? 'evento encontrado' : 'eventos encontrados'}
          </div>
        )}
      </div>

      {loading && (
        <div className="text-gray-600">Cargando eventos...</div>
      )}

      {!loading && errorMsg && (
        <div className="p-4 rounded-lg border border-red-200 bg-red-50 text-red-700">
          {errorMsg}
        </div>
      )}

      {!loading && !errorMsg && !hasEvents && (
        <div className="text-gray-600">
          {searchQuery ? 'No se encontraron eventos con ese criterio.' : 'No hay eventos disponibles.'}
        </div>
      )}

      {!loading && !errorMsg && hasEvents && (
        <div className="grid md:grid-cols-2 gap-6">
          {filteredEvents.map((ev) => {
            const title = ev?.title || ev?.name || "Evento";
            const date = ev?.starts_at ? formatDateCL(ev.starts_at) : "";
            const city = ev?.city || "";
            const venue = ev?.venue || "";
            const imageUrl = ev?.image_url || ev?.poster_url || ev?.cover_image || null;
            
            return (
              <Link
                key={ev.id}
                href={`/events/${ev.id}`}
                className="block rounded-2xl border bg-white hover:shadow-md transition overflow-hidden"
              >
                {/* Imagen del evento */}
                {imageUrl && (
                  <div className="aspect-video w-full bg-gray-100">
                    <img 
                      src={imageUrl} 
                      alt={title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                
                {/* Contenido */}
                <div className="p-5">
                  <div className="text-xl font-semibold">{title}</div>
                  <div className="text-gray-600 mt-1">
                    {date ? `${date}` : ""}
                    {date && (city || venue) ? " · " : ""}
                    {[venue, city].filter(Boolean).join(", ")}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

