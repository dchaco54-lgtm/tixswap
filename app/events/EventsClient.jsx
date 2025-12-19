"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

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

function normalizeText(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD") // quita tildes
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function SearchIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4 text-gray-400"
      viewBox="0 0 20 20"
      fill="currentColor"
    >
      <path
        fillRule="evenodd"
        d="M9 3a6 6 0 104.472 10.03l2.249 2.249a1 1 0 001.414-1.414l-2.249-2.249A6 6 0 009 3zm-4 6a4 4 0 118 0 4 4 0 01-8 0z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export default function EventsClient({ events }) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const nq = normalizeText(q);
    if (!nq) return events;

    return (events || []).filter((ev) => {
      const hay = normalizeText(
        [
          ev.title,
          ev.venue,
          ev.city,
          ev.category,
          // por si después agregas más campos
        ].filter(Boolean).join(" ")
      );

      return hay.includes(nq);
    });
  }, [q, events]);

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-5xl px-4 py-8">
        {/* Barra superior */}
        <div className="mb-4 flex items-center justify-between">
          <Link href="/" className="text-sm text-gray-500 hover:text-gray-700">
            ← Volver al inicio
          </Link>

          <Link
            href="/sell"
            className="inline-flex items-center rounded-full bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
          >
            Publicar entrada
          </Link>
        </div>

        {/* Header + buscador (en el "rojo") */}
        <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">
              Eventos disponibles
            </h1>
            <p className="mt-1 text-sm text-gray-600">
              Elige un evento para ver las entradas publicadas por otros usuarios.
            </p>
          </div>

          {/* 👇 ESTE ES EL BLOQUE DEL BUSCADOR */}
          <div className="lg:w-[420px]">
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
                <SearchIcon />
              </div>

              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar evento (ej: cha, conce, movistar...)"
                className="w-full rounded-full border border-gray-200 bg-white py-2 pl-9 pr-10 text-sm text-gray-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
              />

              {q ? (
                <button
                  type="button"
                  onClick={() => setQ("")}
                  className="absolute inset-y-0 right-2 flex items-center rounded-full px-2 text-xs text-gray-500 hover:text-gray-700"
                  aria-label="Limpiar búsqueda"
                >
                  ✕
                </button>
              ) : null}
            </div>

            <p className="mt-2 text-xs text-gray-500">
              Mostrando <b>{filtered.length}</b> de <b>{events.length}</b>
            </p>
          </div>
        </header>

        {/* Cards */}
        <section className="mt-6 grid gap-4 md:grid-cols-2">
          {filtered.length === 0 ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-600 shadow-sm md:col-span-2">
              No encontré eventos con <b>“{q}”</b>. Prueba con otra palabra.
            </div>
          ) : (
            filtered.map((event) => (
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
                  📍 {(event.venue || "Recinto") +
                    (event.city ? ` · ${event.city}` : "")}
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
