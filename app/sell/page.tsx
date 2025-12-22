"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";

type EventItem = {
  id: string | number;
  title: string;
  venue?: string | null;
  city?: string | null;
  country?: string | null;
  starts_at?: string | null;
};

function formatEventDate(starts_at?: string | null) {
  if (!starts_at) return "";
  const d = new Date(starts_at);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function SellPage() {
  // steps
  const steps = ["Detalles", "Archivo", "Confirmar"];
  const [currentStep] = useState(0);

  // events
  const [events, setEvents] = useState<EventItem[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [eventsError, setEventsError] = useState<string | null>(null);

  const [eventQuery, setEventQuery] = useState("");
  const [eventOpen, setEventOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<EventItem | null>(null);

  const dropdownRef = useRef<HTMLDivElement | null>(null);

  // form fields
  const [description, setDescription] = useState("");
  const [sector, setSector] = useState("");
  const [fila, setFila] = useState("");
  const [asiento, setAsiento] = useState("");
  const [price, setPrice] = useState<string>("50000");
  const [originalPrice, setOriginalPrice] = useState<string>("60000");
  const [saleType, setSaleType] = useState<"fixed" | "auction">("fixed");

  useEffect(() => {
    let alive = true;

    async function loadEvents() {
      setEventsLoading(true);
      setEventsError(null);

      // OJO: mismos campos que tu homepage (app/page.js)
      const { data, error } = await supabase
        .from("events")
        .select("id, title, starts_at, venue, city, country")
        .order("starts_at", { ascending: true })
        .limit(300);

      if (!alive) return;

      if (error) {
        console.error("[sell] supabase events error:", error);
        setEvents([]);
        setEventsError(
          "No pude cargar los eventos (revisa RLS/policies o nombres de columnas en Supabase)."
        );
        setEventsLoading(false);
        return;
      }

      setEvents((data as EventItem[]) || []);
      setEventsLoading(false);
    }

    loadEvents();

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!dropdownRef.current) return;
      if (!dropdownRef.current.contains(e.target as Node)) {
        setEventOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const filteredEvents = useMemo(() => {
    const q = eventQuery.trim().toLowerCase();
    if (!q) return events;
    return events.filter((ev) => {
      const hay =
        `${ev.title ?? ""} ${ev.venue ?? ""} ${ev.city ?? ""} ${ev.country ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [events, eventQuery]);

  function selectEvent(ev: EventItem) {
    setSelectedEvent(ev);
    setEventQuery(ev.title ?? "");
    setEventOpen(false);
  }

  // ui helpers
  const inputBase =
    "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100";
  const labelBase = "text-sm font-medium text-slate-700";

  return (
    <div className="min-h-[calc(100vh-64px)] bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-5xl">
        {/* Header / Stepper en gradiente */}
        <div className="mb-8 rounded-2xl bg-gradient-to-r from-blue-500 to-purple-500 p-[1px] shadow-sm">
          <div className="rounded-2xl bg-white/10">
            <div className="px-6 py-5">
              <h1 className="text-3xl font-semibold text-white">Vender entrada</h1>

              <div className="mt-4 flex items-center gap-3">
                {steps.map((s, i) => {
                  const active = i === currentStep;
                  const done = i < currentStep;

                  return (
                    <div key={s} className="flex flex-1 items-center gap-3">
                      <div
                        className={[
                          "flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold",
                          active
                            ? "bg-white text-blue-600"
                            : done
                            ? "bg-white/70 text-blue-700"
                            : "bg-white/20 text-white",
                        ].join(" ")}
                      >
                        {i + 1}
                      </div>

                      <div className="flex-1">
                        <div className="text-sm font-medium text-white">{s}</div>
                        <div className="mt-2 h-[3px] w-full rounded-full bg-white/20">
                          <div
                            className={[
                              "h-[3px] rounded-full bg-white transition-all",
                              i <= currentStep ? "w-full" : "w-0",
                            ].join(" ")}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <h2 className="text-2xl font-semibold text-slate-900">Detalles de la entrada</h2>
          <p className="mt-1 text-sm text-slate-500">
            Completa la info básica para publicar tu ticket.
          </p>

          {/* Evento */}
          <div className="mt-8">
            <label className={labelBase}>
              Evento <span className="text-red-500">*</span>
            </label>
            <div className="mt-2" ref={dropdownRef}>
              {/* Input + flecha (1 solo control, NO select aparte) */}
              <div className="relative">
                <input
                  className={inputBase + " pr-10"}
                  placeholder="Busca eventos, artistas, lugares..."
                  value={eventQuery}
                  onChange={(e) => {
                    setEventQuery(e.target.value);
                    setEventOpen(true);
                  }}
                  onFocus={() => setEventOpen(true)}
                />
                <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                  {/* chevron */}
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

              {/* Dropdown */}
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
                        const dateLabel = formatEventDate(ev.starts_at);
                        const meta = [
                          ev.venue?.trim() ? ev.venue : null,
                          ev.city?.trim() ? ev.city : null,
                          ev.country?.trim() ? ev.country : null,
                          dateLabel ? dateLabel : null,
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

              {/* Selected pill / helper */}
              {selectedEvent && !eventOpen ? (
                <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="text-sm font-semibold text-slate-900">{selectedEvent.title}</div>
                  <div className="mt-0.5 text-xs text-slate-600">
                    {[
                      selectedEvent.venue,
                      selectedEvent.city,
                      selectedEvent.country,
                      formatEventDate(selectedEvent.starts_at),
                    ]
                      .filter(Boolean)
                      .join(" • ")}
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          {/* Descripción (dejamos solo esto para que no sea redundante con título) */}
          <div className="mt-6">
            <label className={labelBase}>
              Descripción <span className="text-red-500">*</span>
            </label>
            <textarea
              className={inputBase + " min-h-[120px] resize-y"}
              placeholder="Ej: Entrada General - Platea Alta. Indica ubicación exacta, estado, restricciones, etc."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* Sector/Fila/Asiento */}
          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <label className={labelBase}>Sector</label>
              <input
                className={inputBase}
                placeholder="Campo, Platea, etc."
                value={sector}
                onChange={(e) => setSector(e.target.value)}
              />
            </div>
            <div>
              <label className={labelBase}>Fila</label>
              <input
                className={inputBase}
                placeholder="A, B, 1, 2, etc."
                value={fila}
                onChange={(e) => setFila(e.target.value)}
              />
            </div>
            <div>
              <label className={labelBase}>Asiento</label>
              <input
                className={inputBase}
                placeholder="1, 2, 3, etc."
                value={asiento}
                onChange={(e) => setAsiento(e.target.value)}
              />
            </div>
          </div>

          {/* Precios */}
          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className={labelBase}>
                Precio de venta <span className="text-red-500">*</span>
              </label>
              <input
                className={inputBase}
                inputMode="numeric"
                value={price}
                onChange={(e) => setPrice(e.target.value.replace(/[^\d]/g, ""))}
              />
            </div>
            <div>
              <label className={labelBase}>Precio original (opcional)</label>
              <input
                className={inputBase}
                inputMode="numeric"
                value={originalPrice}
                onChange={(e) => setOriginalPrice(e.target.value.replace(/[^\d]/g, ""))}
              />
            </div>
          </div>

          {/* Tipo de venta */}
          <div className="mt-8">
            <div className={labelBase}>Tipo de venta</div>
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
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white">
                    <span className="text-lg font-bold text-emerald-600">$</span>
                  </div>
                  <div>
                    <div className="font-semibold text-slate-900">Precio fijo</div>
                    <div className="mt-0.5 text-sm text-slate-600">
                      Vende inmediatamente al precio que estableciste
                    </div>
                  </div>
                </div>
              </button>

              <button
                type="button"
                disabled
                onClick={() => setSaleType("auction")}
                className="cursor-not-allowed rounded-2xl border border-slate-200 bg-slate-50 p-5 text-left"
                title="Próximamente"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white">
                    <span className="text-lg font-bold text-orange-500">⏱</span>
                  </div>
                  <div>
                    <div className="font-semibold text-slate-900">
                      Subasta <span className="text-sm font-medium text-slate-500">(próximamente)</span>
                    </div>
                    <div className="mt-0.5 text-sm text-slate-600">
                      Deja que los compradores pujen por tu entrada
                    </div>
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Footer actions */}
          <div className="mt-8 flex items-center justify-between">
            <button
              type="button"
              className="rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              className="rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
              // En el paso 1 no avanzamos si no hay evento + descripción (tu lógica real la enchufamos después)
              disabled={!selectedEvent || description.trim().length < 6}
              title={!selectedEvent || description.trim().length < 6 ? "Completa evento y descripción" : ""}
            >
              Continuar
            </button>
          </div>

          <div className="mt-6 text-center text-xs text-slate-400">
            {eventsLoading ? "Cargando eventos..." : `${events.length} eventos cargados.`}
          </div>
        </div>
      </div>
    </div>
  );
}
