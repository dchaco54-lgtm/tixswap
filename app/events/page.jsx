// app/events/page.jsx
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

export const revalidate = 30;

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

async function getEvents() {
  const { data, error } = await supabase
    .from("events")
    .select("id, title, starts_at, venue, city, category, image_url")
    .order("starts_at", { ascending: true });

  if (error) {
    console.error("Error cargando eventos:", error);
    return [];
  }

  return data ?? [];
}

export default async function EventsPage() {
  const events = await getEvents();

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-5xl px-4 py-8">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">
              Eventos disponibles
            </h1>
            <p className="mt-1 text-sm text-gray-600">
              Elige un evento para ver las entradas publicadas por otros usuarios.
            </p>
          </div>
          <Link
            href="/sell"
            className="inline-flex items-center rounded-full bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
          >
            Publicar entrada
          </Link>
        </header>

        <section className="mt-6 grid gap-4 md:grid-cols-2">
          {events.length === 0 ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-600 shadow-sm md:col-span-2">
              Aún no hay eventos en el sistema. (Cárgalos en <b>/admin/events</b>)
            </div>
          ) : (
            events.map((event) => (
              <Link
                key={event.id}
                href={`/events/${event.id}`}
                className="group rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-500 hover:shadow-md"
              >
                <h2 className="text-lg font-semibold text-gray-900 group-hover:text-emerald-700">
                  {event.title || "Evento"}
                </h2>
                <p className="mt-1 text-sm text-gray-600">
                  📅 {formatDate(event.starts_at)}
                  <br />
                  📍 {(event.venue || "Recinto") + (event.city ? ` · ${event.city}` : "")}
                </p>
                <p className="mt-3 text-xs text-emerald-700">
                  Ver entradas disponibles →
                </p>
              </Link>
            ))
          )}
        </section>
      </div>
    </main>
  );
}
