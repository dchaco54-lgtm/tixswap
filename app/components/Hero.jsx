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
    <section className="bg-gradient-to-b from-blue-50 to-white">
      <div className="max-w-6xl mx-auto px-4 py-16 text-center">
        <h2 className="text-4xl md:text-5xl font-bold text-gray-900">
          Intercambia entradas
          <span className="block text-blue-600 mt-2">de forma segura</span>
        </h2>
        <p className="mt-6 text-gray-600 max-w-2xl mx-auto text-lg">
          El marketplace más confiable de Chile para comprar y vender entradas.
          Sistema de garantía, validación de tickets y pago protegido.
        </p>

        <div className="mt-10 flex justify-center">
          <div ref={wrapperRef} className="w-full max-w-2xl relative">
            <input
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              onFocus={() => query?.trim() && setOpen(true)}
              placeholder="Busca eventos, artistas, lugares..."
              className="w-full px-6 py-4 rounded-xl border shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
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
                          className="w-full px-4 py-3 hover:bg-blue-50 flex flex-col"
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
