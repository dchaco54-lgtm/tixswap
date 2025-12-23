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
  const [currentStep] = useState(0); // (por ahora fijo en 0, después lo conectamos al flujo)

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
      const hay = `${ev.title ?? ""} ${ev.venue ?? ""} ${ev.city ?? ""} ${ev.country ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [events, eventQuery]);

  function selectEvent(ev: EventItem) {
    setSelectedEvent(ev);
    setEventQuery(ev.title ?? "");
    setEventOpen(false);
  }

  // helpers
  const inputBase = "tix-input";
  const textareaBase = "tix-textarea";
  const labelBase = "text-sm font-medium text-slate-700";

  return (
    <div className="min-h-[calc(100vh-64px)] px-4 py-8">
      <div className="tix-container max-w-5xl">
        {/* ✅ Header / Stepper (NO transparente, estilo imagen 2) */}
        <div className="mb-8 overflow-hidden rounded-3xl shadow-soft">
          <div className="tix-header-gradient px-8 py-10">
            <h1 className="text-4xl font-bold text-white">Vender entrada</h1>

            <div className="mt-7 flex items-center">
              {steps.map((s, i) => {
                const active = i === currentStep;
                const done = i < currentStep;

                return (
                  <div key={s} className="flex items-center flex-1">
                    {/* Paso */}
                    <div className="flex items-center gap-4">
                      <div
                        className={[
                          "flex h-12 w-12 items-center justify-center rounded-full text-base font-bold",
                          active
                            ? "bg-white text-blue-700"
                            : done
                            ? "bg-white/80 text-blue-800"
                            : "bg-blue-400/60 text-white",
                        ].join(" ")}
                      >
                        {i + 1}
                      </div>

                      <div className="text-lg font-semibold text-white">{s}</div>
                    </div>

                    {/* Conector */}
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

        {/* ✅ Card principal */}
        <div className="tix-card p-8">
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
                            {meta ? <div className="mt-0.5 text-xs text-slate-600">{meta}</div> : null}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {selectedEvent && !eventOpen ? (
                <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="text-sm font-semibold text-slate-900">{selectedEvent.title}</div>
                  <div className="mt-0.5 text-xs text-slate-600">
                    {[selectedEvent.venue, selectedEvent.city, selectedEvent.country, formatEventDate(selectedEvent.starts_at)]
                      .filter(Boolean)
                      .join(" • ")}
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          {/* Descripción */}
          <div className="mt-6">
            <label className={labelBase}>
              Descripción <span className="text-red-500">*</span>
            </label>
            <textarea
              className={textareaBase + " min-h-[120px] resize-y"}
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
                      Subasta{" "}
                      <span className="text-sm font-medium text-slate-500">(próximamente)</span>
                    </div>
                    <div className="mt-0.5 text-sm text-slate-600">
                      Deja que los compradores pujen por tu entrada
                    </div>
                  </div>
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
              title={
                !selectedEvent || description.trim().length < 6
                  ? "Completa evento y descripción"
                  : ""
              }
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
