"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";
import { EVENTS as FRONT_EVENTS } from "../../lib/events";

const ADMIN_EMAILS = [
  "soporte@tixswap.cl",
  "davidchacon_17@hotmail.com",
].map((e) => e.toLowerCase());

const initialForm = {
  title: "",
  category: "",
  date: "",
  time: "21:00",
  venue: "",
  city: "",
  image_url: "",
};

function formatDate(iso) {
  if (!iso) return "Fecha por confirmar";
  const d = new Date(iso);
  return d.toLocaleString("es-CL", {
    year: "numeric",
    month: "long",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function parseLocation(location) {
  if (!location) return { venue: null, city: null };
  const parts = String(location).split("—").map((s) => s.trim());
  const venue = parts[0] || null;
  let city = parts[1] || null;

  if (city) city = city.replace(/,\s*Chile\s*$/i, "").trim();

  return { venue, city };
}

function chunkArray(arr, size) {
  const res = [];
  for (let i = 0; i < arr.length; i += size) res.push(arr.slice(i, i + size));
  return res;
}

export default function AdminEventsPage() {
  const router = useRouter();

  const [checkingAdmin, setCheckingAdmin] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);

  const [events, setEvents] = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(true);

  const [importing, setImporting] = useState(false);

  // ✅ Admin whitelist (incluye tu hotmail)
  useEffect(() => {
    const checkAdmin = async () => {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (error || !user) {
        router.replace("/login");
        return;
      }

      const email = (user.email || "").toLowerCase();

      if (!ADMIN_EMAILS.includes(email)) {
        router.replace("/dashboard");
        return;
      }

      setIsAdmin(true);
      setCheckingAdmin(false);
    };

    checkAdmin();
  }, [router]);

  const loadEvents = async () => {
    setLoadingEvents(true);
    try {
      const { data, error } = await supabase
        .from("events")
        .select("id, title, category, starts_at, venue, city, image_url")
        .order("starts_at", { ascending: true });

      if (error) {
        console.error("Error cargando events:", error);
        setEvents([]);
        return;
      }

      setEvents(data || []);
    } finally {
      setLoadingEvents(false);
    }
  };

  useEffect(() => {
    if (!checkingAdmin && isAdmin) loadEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkingAdmin, isAdmin]);

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
  };

  const createEvent = async (e) => {
    e.preventDefault();

    if (!form.title || !form.date) {
      alert("Título y fecha son obligatorios.");
      return;
    }

    setSubmitting(true);
    try {
      const startsAt = new Date(`${form.date}T${form.time || "21:00"}:00`);

      const { error } = await supabase.from("events").insert({
        title: form.title,
        category: form.category || null,
        venue: form.venue || null,
        city: form.city || null,
        image_url: form.image_url || null,
        starts_at: startsAt.toISOString(),
      });

      if (error) {
        console.error("Error insert events:", error);
        alert(`Error al guardar evento:\n${error.message || "revisa consola"}`);
        return;
      }

      alert("Evento creado ✅");
      setForm(initialForm);
      await loadEvents();
    } finally {
      setSubmitting(false);
    }
  };

  const importFrontEvents = async () => {
    setImporting(true);
    try {
      const { data: current, error: currentErr } = await supabase
        .from("events")
        .select("title, starts_at, venue, city");

      if (currentErr) {
        console.error("Error leyendo events:", currentErr);
        alert("No se pudo cargar eventos actuales.");
        return;
      }

      const currentSet = new Set(
        (current || []).map((e) =>
          `${e.title || ""}|${e.starts_at || ""}|${e.venue || ""}|${e.city || ""}`.toLowerCase()
        )
      );

      const toInsert = [];
      for (const ev of FRONT_EVENTS) {
        const startsAtIso = ev.dateISO ? new Date(ev.dateISO).toISOString() : null;
        const { venue, city } = parseLocation(ev.location);

        const key = `${ev.title || ""}|${startsAtIso || ""}|${venue || ""}|${city || ""}`.toLowerCase();
        if (currentSet.has(key)) continue;

        toInsert.push({
          title: ev.title || null,
          category: ev.category || null,
          venue,
          city,
          image_url: null,
          starts_at: startsAtIso,
        });
      }

      if (toInsert.length === 0) {
        alert("No hay eventos nuevos para importar (ya estaban creados).");
        return;
      }

      const chunks = chunkArray(toInsert, 50);
      let inserted = 0;

      for (const chunk of chunks) {
        const { error } = await supabase.from("events").insert(chunk);
        if (error) {
          console.error("Error importando chunk:", error);
          alert(`Falló la importación:\n${error.message || "revisa consola"}`);
          return;
        }
        inserted += chunk.length;
      }

      alert(`Importados ${inserted} eventos ✅`);
      await loadEvents();
    } finally {
      setImporting(false);
    }
  };

  if (checkingAdmin) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="rounded-2xl bg-white px-6 py-4 shadow-sm border border-gray-100 text-sm text-gray-700">
          Verificando acceso...
        </div>
      </main>
    );
  }

  if (!isAdmin) return null;

  return (
    <main className="min-h-screen bg-gray-50 py-10">
      <div className="mx-auto max-w-5xl px-4">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Admin · Eventos</h1>
            <p className="mt-1 text-sm text-gray-600">
              Crea/importa eventos para que aparezcan en /sell y /events.
            </p>
          </div>

          <button
            onClick={importFrontEvents}
            disabled={importing}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {importing ? "Importando..." : "Importar eventos del listado (front)"}
          </button>
        </header>

        <section className="mt-6 rounded-2xl bg-white border border-gray-100 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Crear evento manual</h2>

          <form onSubmit={createEvent} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Título *</label>
              <input
                name="title"
                value={form.title}
                onChange={onChange}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                placeholder="Ej: Chayanne"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Categoría</label>
              <input
                name="category"
                value={form.category}
                onChange={onChange}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                placeholder="Pop, Rock, Festival..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Fecha *</label>
              <input
                type="date"
                name="date"
                value={form.date}
                onChange={onChange}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Hora</label>
              <input
                type="time"
                name="time"
                value={form.time}
                onChange={onChange}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Recinto</label>
              <input
                name="venue"
                value={form.venue}
                onChange={onChange}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                placeholder="Estadio Nacional"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Ciudad</label>
              <input
                name="city"
                value={form.city}
                onChange={onChange}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                placeholder="Santiago"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700">Imagen URL</label>
              <input
                name="image_url"
                value={form.image_url}
                onChange={onChange}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                placeholder="https://..."
              />
            </div>

            <div className="md:col-span-2 flex justify-end">
              <button
                type="submit"
                disabled={submitting}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {submitting ? "Guardando..." : "Crear evento"}
              </button>
            </div>
          </form>
        </section>

        <section className="mt-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Eventos en backend</h2>

          {loadingEvents ? (
            <div className="text-sm text-gray-500">Cargando eventos...</div>
          ) : events.length === 0 ? (
            <div className="rounded-2xl bg-white border border-gray-100 p-6 text-sm text-gray-600 shadow-sm">
              No hay eventos aún. Usa el botón de importar o crea uno manual.
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {events.map((e) => (
                <div
                  key={e.id}
                  className="rounded-2xl bg-white border border-gray-100 p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-gray-900">{e.title || "Evento"}</p>
                      <p className="mt-1 text-sm text-gray-600">
                        📅 {formatDate(e.starts_at)}
                        <br />
                        📍 {(e.venue || "Recinto") + (e.city ? ` · ${e.city}` : "")}
                      </p>
                      {e.category ? (
                        <p className="mt-2 text-xs text-gray-500">Categoría: {e.category}</p>
                      ) : null}
                    </div>
                    <span className="text-xs text-gray-400">{String(e.id).slice(0, 8)}…</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
