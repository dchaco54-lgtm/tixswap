// app/events/page.jsx

import Link from "next/link";
import { EVENTS } from "../lib/events";

export default function EventsPage() {
  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-5xl px-4 py-8">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">
              Eventos disponibles
            </h1>
            <p className="mt-1 text-sm text-gray-600">
              Elige un evento para ver las entradas publicadas.
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
          {EVENTS.map((event) => (
            <Link
              key={event.id}
              href={`/events/${event.id}`}
              className="group rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-500 hover:shadow-md"
            >
              <h2 className="text-lg font-semibold text-gray-900 group-hover:text-emerald-700">
                {event.title}
              </h2>

              <p className="mt-1 text-sm text-gray-600">
                📅 {event.date}
                <br />
                📍 {event.location}
              </p>

              <p className="mt-3 text-xs text-emerald-700">
                Ver entradas disponibles →
              </p>
            </Link>
          ))}
        </section>
      </div>
    </main>
  );
}
