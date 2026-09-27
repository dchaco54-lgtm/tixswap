// app/components/Hero.jsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export default function Hero({
  query,
  onQueryChange,
  suggestions = [],
  isLoading = false,
  onSelectSuggestion,
}) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    const onDocClick = (e) => {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  useEffect(() => {
    if ((query || "").trim().length > 0) setOpen(true);
    else setOpen(false);
  }, [query]);

  const hasResults = useMemo(() => (suggestions || []).length > 0, [suggestions]);

  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-[#F2ECFF] to-white">
      <div className="pointer-events-none absolute -right-24 -top-32 h-72 w-72 rounded-full bg-[#D83CFF]/15 blur-3xl" />
      <div className="pointer-events-none absolute -left-24 bottom-0 h-64 w-64 rounded-full bg-[#FF4D5E]/10 blur-3xl" />
      <div className="relative max-w-6xl mx-auto px-4 py-16 text-center md:py-20">
        <p className="font-display text-sm font-semibold uppercase tracking-[0.18em] text-[#4A1E9E]">
          Tu entrada. Tu evento. Tu lugar.
        </p>
        <h1 className="font-display mt-4 text-4xl font-bold text-[#1A1333] md:text-6xl">
          Encuentra tu próxima entrada
          <span className="brand-gradient-text mt-2 block">o dale un nuevo destino</span>
        </h1>
        <p className="mt-6 text-gray-600 max-w-2xl mx-auto text-lg leading-relaxed">
          Compra y vende entradas entre personas, con información clara, soporte
          y trazabilidad durante el proceso.
        </p>

        <div className="mt-10 flex justify-center">
          <div ref={wrapperRef} className="w-full max-w-2xl relative">
            <input
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              onFocus={() => query?.trim() && setOpen(true)}
              placeholder="Busca eventos, artistas, lugares..."
              aria-label="Buscar eventos"
              className="brand-focus w-full rounded-2xl border border-[#D8C8FF] bg-white px-6 py-4 text-[#1A1333] shadow-[0_18px_50px_rgba(74,30,158,0.12)] focus:border-[#7B3FF2] focus:outline-none"
            />

            {open && (
              <div className="absolute left-0 right-0 mt-2 bg-white border rounded-xl shadow-lg overflow-hidden text-left z-20">
                {isLoading ? (
                  <div className="px-4 py-3 text-sm text-gray-600">
                    Buscando eventos…
                  </div>
                ) : hasResults ? (
                  <ul className="max-h-80 overflow-auto">
                    {suggestions.map((ev) => (
                      <li key={ev.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setOpen(false);
                            onSelectSuggestion?.(ev);
                          }}
                          className="brand-focus w-full px-4 py-3 hover:bg-[#F2ECFF] flex flex-col"
                        >
                          <span className="font-semibold text-gray-900">
                            {ev.title}
                          </span>
                          <span className="text-sm text-gray-600">
                            {ev.meta}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="px-4 py-3 text-sm text-gray-600">
                    No encontré eventos con ese texto.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
