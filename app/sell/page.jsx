"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

function formatEventDate(starts_at) {
  if (!starts_at) return "";
  const d = new Date(starts_at);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// 🔥 Esto evita que la web dependa de nombres exactos de columnas
function normalizeEventRow(e) {
  return {
    id: e.id ?? e.event_id ?? e.uuid ?? e.slug ?? String(Math.random()),
    title: e.title ?? e.name ?? e.event_name ?? e.nombre ?? "Evento sin nombre",
    starts_at: e.starts_at ?? e.start_at ?? e.date ?? e.start_date ?? e.fecha ?? null,
    venue: e.venue ?? e.place ?? e.location ?? e.venue_name ?? e.lugar ?? null,
    city: e.city ?? e.ciudad ?? null,
    country: e.country ?? e.pais ?? null,
  };
}

export default function SellPage() {
  const steps = ["Detalles", "Archivo", "Confirmar"];
  const [currentStep] = useState(0);

  const [events, setEvents] = useState([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [eventsError, setEventsError] = useState(null);

  const [eventQuery, setEventQuery] = useState("");
  const [eventOpen, setEventOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const dropdownRef = useRef(null);

  const [description, setDescription] = useState("");
  const [sector, setSector] = useState("");
  const [fila, setFila] = useState("");
  const [asiento, setAsiento] = useState("");
  const [price, setPrice] = useState("50000");
  const [originalPrice, setOriginalPrice] = useState("60000");
  const [saleType, setSaleType] = useState("fixed");

  useEffect(() => {
    let alive = true;

    async function loadEvents() {
      setEventsLoading(true);
      setEventsError(null);

      // ✅ A prueba de columnas: trae todo
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .limit(300);

      if (!alive) return;

      if (error) {
        console.error("[sell] supabase events error:", error);
        setEvents([]);
        // ✅ muestra el error REAL (para cachar al tiro si es RLS o columnas)
        setEventsError(error.message || "Error cargando eventos");
        setEventsLoading(false);
        return;
      }

      const normalized = (data || []).map(normalizeEventRow);

      // ✅ Ordenamos en JS (para no depender de starts_at en SQL)
      normalized.sort((a, b) => {
        const ta = a.starts_at ? new Date(a.starts_at).getTime() : 0;
        const tb = b.starts_at ? new Date(b.starts_at).getTime() : 0;
        return ta - tb;
      });

      setEvents(normalized);
      setEventsLoading(false);
    }

    loadEvents();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    function onDocClick(e) {
      if (!dropdownRef.current) return;
      if (!dropdownRef.current.contains(e.target)) setEventOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const filteredEvents = useMemo(() => {
    const q = eventQuery.trim().toLowerCase();
    if (!q) return events;
    return events.filter((ev) => {
      const hay = `${ev.title ?? ""} ${ev.venue ?? ""} ${ev.city ?? ""} ${ev.country ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [events, eventQuery]);

  function selectEvent(ev) {
    setSelectedEvent(ev);
    setEventQuery(ev.title ?? "");
    setEventOpen(false);
  }

  return (
    <div className="min-h-[calc(100vh-64px)] bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-5xl">
        {/* Stepper (como imagen 2, sólido, NO transparente) */}
        <div className="mb-8 overflow-hidden rounded-3xl shadow-soft">
          <div className="bg-gradient-to-r from-blue-500 to-purple-500 px-8 py-10">
            <h1 className="text-4xl font-bold text-white">Vender entrada</h1>

            <div className="mt-7 flex items-center">
              {steps.map((s, i) => {
                const active = i === currentStep;
                const done = i < currentStep;

                return (
                  <div key={s} className="flex flex-1 items-center">
                    <div className="flex items-center gap-4">
                      <div
                        className={[
                          "flex h-12 w-12 items-center justify-center rounded-full text-base font-extrabold",
                          active
                            ? "bg-white text-blue-700"
                            : done
                            ? "bg-white/80 text-blue-800"
                            : "bg-white/25 text-white",
                        ].join(" ")}
                      >
                        {i + 1}
                      </div>

                      <div className="text-lg font-semibold text-white">{s}</div>
                    </div>

                    {i < steps.length - 1 && (
                      <div className="mx-6 h-[3px] flex-1 rounded-full bg-white/25">
                        <div
                          className={[
                            "h-[3px] rounded-full bg-white transition-all duration-300",
                            i < currentStep ? "w-full" : "w-0",
                          ].join(" ")}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Form card */}
        <div className="tix-card p-8">
          <h2 className="text-2xl font-semibold text-slate-900">Detalles de la entrada</h2>
          <p className="mt-1 text-sm text-slate-500">
            Completa la info básica para publicar tu ticket.
          </p>

          {/* Evento */}
          <div className="mt-8" ref={dropdownRef}>
            <label className="text-sm font-medium text-slate-700">
              Evento <span className="text-red-500">*</span>
            </label>

            <div className="mt-2 relative">
              <input
                className="tix-input pr-10"
                placeholder="Busca eventos, artistas, lugares..."
                value={eventQuery}
                onChange={(e) => {
                  setEventQuery(e.target.value);
                  setEventOpen(true);
                }}
                onFocus={() => setEventOpen(true)}
              />
              <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                  <path
                    d="M6 8l4 4 4-4"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            </div>

            {eventOpen && (
              <div className="mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
                {eventsLoading ? (
                  <div className="px-4 py-3 text-sm text-slate-500">Cargando eventos…</div>
                ) : eventsError ? (
                  <div className="px-4 py-3 text-sm text-red-600">{eventsError}</div>
                ) : filteredEvents.length === 0 ? (
                  <div className="px-4 py-3 text-sm text-slate-500">
                    No encontré eventos con “{eventQuery}”.
                  </div>
                ) : (
                  <div className="max-h-72 overflow-auto">
                    {filteredEvents.map((ev) => {
                      const meta = [
                        ev.venue,
                        ev.city,
                        ev.country,
                        formatEventDate(ev.starts_at),
                      ]
                        .filter(Boolean)
                        .join(" • ");

                      const isSelected = selectedEvent?.id === ev.id;

                      return (
                        <button
                          key={String(ev.id)}
                          type="button"
                          onClick={() => selectEvent(ev)}
                          className={[
                            "w-full text-left px-4 py-3 transition",
                            isSelected ? "bg-blue-50" : "hover:bg-slate-50",
                          ].join(" ")}
                        >
                          <div className="text-sm font-semibold text-slate-900">{ev.title}</div>
                          {meta ? (
                            <div className="mt-0.5 text-xs text-slate-600">{meta}</div>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Descripción */}
          <div className="mt-6">
            <label className="text-sm font-medium text-slate-700">
              Descripción <span className="text-red-500">*</span>
            </label>
            <textarea
              className="tix-textarea mt-2 min-h-[120px] resize-y"
              placeholder="Ej: Entrada General - Platea Alta. Indica ubicación exacta, estado, restricciones, etc."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* Sector/Fila/Asiento */}
          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <label className="text-sm font-medium text-slate-700">Sector</label>
              <input
                className="tix-input mt-2"
                placeholder="Campo, Platea, etc."
                value={sector}
                onChange={(e) => setSector(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Fila</label>
              <input
                className="tix-input mt-2"
                placeholder="A, B, 1, 2, etc."
                value={fila}
                onChange={(e) => setFila(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Asiento</label>
              <input
                className="tix-input mt-2"
                placeholder="1, 2, 3, etc."
                value={asiento}
                onChange={(e) => setAsiento(e.target.value)}
              />
            </div>
          </div>

          {/* Precios */}
          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-slate-700">
                Precio de venta <span className="text-red-500">*</span>
              </label>
              <input
                className="tix-input mt-2"
                inputMode="numeric"
                value={price}
                onChange={(e) => setPrice(e.target.value.replace(/[^\d]/g, ""))}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Precio original (opcional)</label>
              <input
                className="tix-input mt-2"
                inputMode="numeric"
                value={originalPrice}
                onChange={(e) => setOriginalPrice(e.target.value.replace(/[^\d]/g, ""))}
              />
            </div>
          </div>

          {/* Tipo de venta */}
          <div className="mt-8">
            <div className="text-sm font-medium text-slate-700">Tipo de venta</div>
            <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
              <button
                type="button"
                onClick={() => setSaleType("fixed")}
                className={[
                  "rounded-2xl border p-5 text-left transition",
                  saleType === "fixed"
                    ? "border-blue-500 bg-blue-50 ring-4 ring-blue-100"
                    : "border-slate-200 hover:bg-slate-50",
                ].join(" ")}
              >
                <div className="font-semibold text-slate-900">Precio fijo</div>
                <div className="mt-1 text-sm text-slate-600">
                  Vende inmediatamente al precio que estableciste
                </div>
              </button>

              <button
                type="button"
                disabled
                className="cursor-not-allowed rounded-2xl border border-slate-200 bg-slate-50 p-5 text-left"
                title="Próximamente"
              >
                <div className="font-semibold text-slate-900">Subasta (próximamente)</div>
                <div className="mt-1 text-sm text-slate-600">
                  Deja que los compradores pujen por tu entrada
                </div>
              </button>
            </div>
          </div>

          {/* Acciones */}
          <div className="mt-8 flex items-center justify-between">
            <button type="button" className="tix-btn-secondary">
              Cancelar
            </button>

            <button
              type="button"
              className="tix-btn-primary"
              disabled={!selectedEvent || description.trim().length < 6}
              title={!selectedEvent || description.trim().length < 6 ? "Completa evento y descripción" : ""}
            >
              Continuar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
