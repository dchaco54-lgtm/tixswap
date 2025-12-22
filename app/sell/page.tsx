"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import supabase from "../lib/supabaseClient";

type EventItem = {
  id: string | number;
  name: string;
  venue?: string | null;
  city?: string | null;
  date?: string | null;
};

function formatEventDate(date?: string | null) {
  if (!date) return "";
  try {
    const d = new Date(date);
    // Formato simple para Chile
    return d.toLocaleDateString("es-CL", { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

export default function SellPage() {
  // Data
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);

  // Event selector (combobox)
  const [eventOpen, setEventOpen] = useState(false);
  const [eventQuery, setEventQuery] = useState("");
  const [selectedEvent, setSelectedEvent] = useState<EventItem | null>(null);
  const [eventNotListed, setEventNotListed] = useState(false);

  // Form
  const [description, setDescription] = useState("");
  const [sector, setSector] = useState("");
  const [row, setRow] = useState("");
  const [seat, setSeat] = useState("");
  const [price, setPrice] = useState("");
  const [originalPrice, setOriginalPrice] = useState("");
  const [saleType, setSaleType] = useState<"fixed" | "auction">("fixed");

  const comboRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const fetchEvents = async () => {
      setLoadingEvents(true);
      const { data, error } = await supabase
        .from("events")
        .select("id,name,venue,city,date")
        .order("date", { ascending: true });

      if (!error && data) {
        setEvents(data as EventItem[]);
      }
      setLoadingEvents(false);
    };

    fetchEvents();
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!comboRef.current) return;
      if (!comboRef.current.contains(e.target as Node)) {
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
        `${ev.name ?? ""} ${ev.venue ?? ""} ${ev.city ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [events, eventQuery]);

  const canContinue =
    (!!selectedEvent || eventNotListed) &&
    description.trim().length > 0 &&
    price.trim().length > 0 &&
    saleType === "fixed"; // subasta no disponible

  // Handlers
  const onPickEvent = (ev: EventItem) => {
    setSelectedEvent(ev);
    setEventQuery(ev.name);
    setEventOpen(false);
    setEventNotListed(false);
  };

  const onToggleNotListed = (v: boolean) => {
    setEventNotListed(v);
    if (v) {
      setSelectedEvent(null);
      setEventQuery("");
      setEventOpen(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F6F9FF]">
      <div className="mx-auto max-w-5xl px-4 py-10">
        {/* Título arriba, como tu referencia */}
        <h1 className="mb-6 text-3xl font-extrabold tracking-tight text-slate-900">
          Vender entrada
        </h1>

        <div className="tix-card overflow-hidden">
          {/* Header gradient */}
          <div className="tix-header-gradient px-8 py-8 text-white">
            <div className="text-3xl font-extrabold">Vender entrada</div>

            {/* Stepper */}
            <div className="mt-6 flex items-center gap-6">
              {/* Step 1 active */}
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-blue-600 font-bold">
                  1
                </div>
                <div className="font-semibold">Detalles</div>
              </div>

              <div className="h-[2px] flex-1 bg-white/35" />

              {/* Step 2 */}
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-white font-bold">
                  2
                </div>
                <div className="font-semibold text-white/90">Archivo</div>
              </div>

              <div className="h-[2px] flex-1 bg-white/35" />

              {/* Step 3 */}
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-white font-bold">
                  3
                </div>
                <div className="font-semibold text-white/90">Confirmar</div>
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="px-8 py-10">
            <h2 className="text-3xl font-extrabold text-slate-900">Detalles de la entrada</h2>

            <div className="mt-8 space-y-6">
              {/* Evento */}
              <div>
                <div className="mb-2 text-sm font-semibold text-slate-900">
                  Evento <span className="text-blue-600">*</span>
                </div>

                <div className="mb-3 flex items-start gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
                  <input
                    type="checkbox"
                    checked={eventNotListed}
                    onChange={(e) => onToggleNotListed(e.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-slate-300"
                  />
                  <div>
                    <div className="font-semibold text-slate-900">Mi evento no está en el listado</div>
                    <div className="text-sm text-slate-600">
                      Dejas la solicitud y Soporte lo crea para completar el evento.
                    </div>
                  </div>
                </div>

                {/* Combobox */}
                <div ref={comboRef} className="relative">
                  <div className="relative">
                    <input
                      disabled={eventNotListed}
                      value={eventQuery}
                      onChange={(e) => {
                        setEventQuery(e.target.value);
                        setSelectedEvent(null);
                        if (!eventNotListed) setEventOpen(true);
                      }}
                      onFocus={() => {
                        if (!eventNotListed) setEventOpen(true);
                      }}
                      placeholder={eventNotListed ? "Evento no listado" : "Busca eventos, artistas, lugares..."}
                      className={`tix-input pr-12 ${eventNotListed ? "opacity-60" : ""}`}
                    />

                    {/* Botón flecha “bonito” */}
                    <button
                      type="button"
                      disabled={eventNotListed}
                      onClick={() => !eventNotListed && setEventOpen((s) => !s)}
                      className={`absolute right-2 top-1/2 -translate-y-1/2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-700 hover:bg-slate-100 transition ${
                        eventNotListed ? "opacity-60" : ""
                      }`}
                      aria-label="Desplegar eventos"
                    >
                      <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                        <path
                          d="M6 8l4 4 4-4"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                  </div>

                  {/* Dropdown */}
                  {eventOpen && !eventNotListed && (
                    <div className="absolute z-50 mt-2 w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-soft">
                      <div className="max-h-72 overflow-auto p-2">
                        {loadingEvents ? (
                          <div className="px-3 py-3 text-sm text-slate-600">
                            Cargando eventos...
                          </div>
                        ) : filteredEvents.length === 0 ? (
                          <div className="px-3 py-3 text-sm text-slate-600">
                            No encontré eventos con “{eventQuery}”.
                          </div>
                        ) : (
                          filteredEvents.map((ev) => (
                            <button
                              key={ev.id}
                              type="button"
                              onClick={() => onPickEvent(ev)}
                              className="w-full rounded-xl px-3 py-3 text-left hover:bg-blue-50 transition"
                            >
                              <div className="font-semibold text-slate-900">{ev.name}</div>
                              <div className="text-sm text-slate-600">
                                {(ev.venue ? ev.venue : "—")}
                                {" — "}
                                {(ev.city ? ev.city : "Chile")}
                                {ev.date ? ` • ${formatEventDate(ev.date)}` : ""}
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Descripción (único campo “texto” como UX mejor) */}
              <div>
                <div className="mb-2 text-sm font-semibold text-slate-900">
                  Descripción <span className="text-blue-600">*</span>
                </div>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ej: Entrada General - Platea Alta. Indica ubicación exacta, estado, restricciones, etc."
                  className="tix-textarea min-h-[130px]"
                />
              </div>

              {/* Sector / Fila / Asiento */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div>
                  <div className="mb-2 text-sm font-semibold text-slate-900">Sector</div>
                  <input
                    value={sector}
                    onChange={(e) => setSector(e.target.value)}
                    placeholder="Campo, Platea, etc."
                    className="tix-input"
                  />
                </div>
                <div>
                  <div className="mb-2 text-sm font-semibold text-slate-900">Fila</div>
                  <input
                    value={row}
                    onChange={(e) => setRow(e.target.value)}
                    placeholder="A, B, 1, 2, etc."
                    className="tix-input"
                  />
                </div>
                <div>
                  <div className="mb-2 text-sm font-semibold text-slate-900">Asiento</div>
                  <input
                    value={seat}
                    onChange={(e) => setSeat(e.target.value)}
                    placeholder="1, 2, 3, etc."
                    className="tix-input"
                  />
                </div>
              </div>

              {/* Precios */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <div className="mb-2 text-sm font-semibold text-slate-900">
                    Precio de venta <span className="text-blue-600">*</span>
                  </div>
                  <input
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="50000"
                    inputMode="numeric"
                    className="tix-input"
                  />
                </div>
                <div>
                  <div className="mb-2 text-sm font-semibold text-slate-900">
                    Precio original <span className="text-slate-500 font-medium">(opcional)</span>
                  </div>
                  <input
                    value={originalPrice}
                    onChange={(e) => setOriginalPrice(e.target.value)}
                    placeholder="60000"
                    inputMode="numeric"
                    className="tix-input"
                  />
                </div>
              </div>

              {/* Tipo de venta */}
              <div>
                <div className="mb-3 text-sm font-semibold text-slate-900">Tipo de venta</div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {/* Precio fijo */}
                  <button
                    type="button"
                    onClick={() => setSaleType("fixed")}
                    className={`rounded-2xl border p-5 text-left transition ${
                      saleType === "fixed"
                        ? "border-blue-500 bg-blue-50 shadow-soft"
                        : "border-slate-200 bg-white hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="text-green-600 font-bold text-xl">$</div>
                      <div className="text-lg font-extrabold text-slate-900">Precio fijo</div>
                    </div>
                    <div className="mt-1 text-sm text-slate-600">
                      Vende inmediatamente al precio que estableciste
                    </div>
                  </button>

                  {/* Subasta (deshabilitado) */}
                  <button
                    type="button"
                    onClick={() => setSaleType("auction")}
                    disabled
                    className="rounded-2xl border border-slate-200 bg-white p-5 text-left opacity-70 cursor-not-allowed"
                  >
                    <div className="flex items-center gap-3">
                      <div className="text-orange-500 font-bold text-xl">⏱</div>
                      <div className="text-lg font-extrabold text-slate-900">
                        Subasta <span className="ml-2 text-sm font-semibold text-slate-500">(próximamente)</span>
                      </div>
                    </div>
                    <div className="mt-1 text-sm text-slate-600">
                      Deja que los compradores pujen por tu entrada
                    </div>
                  </button>
                </div>
              </div>

              {/* Footer actions */}
              <div className="flex items-center justify-end gap-3 pt-3">
                <button type="button" className="tix-btn-secondary">
                  Cancelar
                </button>
                <button
                  type="button"
                  className={`tix-btn-primary ${!canContinue ? "opacity-60 cursor-not-allowed" : ""}`}
                  disabled={!canContinue}
                >
                  Continuar
                </button>
              </div>

              <div className="pt-2 text-center text-xs text-slate-400">
                {events.length} eventos cargados.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
