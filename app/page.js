// app/page.js
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Hero from "./components/Hero";
import EventGrid from "./components/EventGrid";
import Categories from "./components/Categories";
import CTA from "./components/CTA";
import Footer from "./components/Footer";
import { supabase } from "./lib/supabaseClient";

function norm(str) {
  return (str || "")
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function formatMeta(event) {
  const title = event?.title || event?.name || "";
  const venue = event?.venue || event?.location || "";
  const city = event?.city || "";
  let dateLabel = "";
  try {
    if (event?.starts_at) {
      dateLabel = new Intl.DateTimeFormat("es-CL", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(new Date(event.starts_at));
    }
  } catch {}

  const parts = [dateLabel, venue, city].filter(Boolean);
  return parts.join(" · ");
}

// Orden global: próximos primero (más cercanos a hoy), luego futuros lejanos, y al final pasados
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

export default function HomePage() {
  const router = useRouter();

  const [user, setUser] = useState(null);
  const [events, setEvents] = useState([]);
  const [eventsLoading, setEventsLoading] = useState(true);

  const [query, setQuery] = useState("");

  // Load user (para decidir redirect al seleccionar sugerencia)
  useEffect(() => {
    const loadUser = async () => {
      const { data } = await supabase.auth.getUser();
      setUser(data?.user || null);
    };
    loadUser();
  }, []);

  // Load events (para buscador y destacados)
  useEffect(() => {
    const loadEvents = async () => {
      setEventsLoading(true);
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .order("starts_at", { ascending: true, nullsFirst: false });

      if (!error) {
        const sorted = sortEventsByProximity(Array.isArray(data) ? data : []);
        setEvents(sorted);
      }
      setEventsLoading(false);
    };

    loadEvents();
  }, []);

  const suggestions = useMemo(() => {
    const q = norm(query);
    if (!q) return [];

    const matches = (events || [])
      .filter((ev) => {
        const hay = norm(
          `${ev?.title || ev?.name || ""} ${ev?.venue || ev?.location || ""} ${ev?.city || ""}`
        );
        return hay.includes(q);
      })
      .slice(0, 8)
      .map((ev) => ({
        id: ev.id,
        title: ev?.title || ev?.name || "Evento",
        meta: formatMeta(ev),
      }));

    return matches;
  }, [query, events]);

  const handleSelectSuggestion = async (ev) => {
    const target = `/events/${ev.id}`;

    if (user) {
      router.push(target);
      return;
    }
    router.push(`/login?redirectTo=${encodeURIComponent(target)}`);
  };

  return (
    <main className="min-h-screen">
      <Hero
        query={query}
        onQueryChange={setQuery}
        suggestions={suggestions}
        isLoading={eventsLoading}
        onSelectSuggestion={handleSelectSuggestion}
      />

      <EventGrid title="Eventos destacados" events={events} />

      <section id="como-funciona" className="scroll-mt-24">
  {/* Compatibilidad por si algún link viejo apunta a #how-it-works */}
  <div id="how-it-works" className="h-0" />
  <Categories />
</section>
      <CTA />
      <Footer />
    </main>
  );
}
