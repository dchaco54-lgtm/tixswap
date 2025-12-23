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

  // ✅ Evento no creado: solicitud a soporte
  const [requestEvent, setRequestEvent] = useState(false);
  const [requestedEventName, setRequestedEventName] = useState("");
  const [requestedEventExtra, setRequestedEventExtra] = useState("");
  const [requestSending, setRequestSending] = useState(false);

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
      const { data, error } = await supabase.from("events").select("*").limit(300);

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
    return events.filter((ev) =>
      [ev.title, ev.venue, ev.city, formatEventDate(ev.starts_at)]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [events, eventQuery]);

  async function handleRequestSupport() {
    if (requestSending) return;

    const name = requestedEventName.trim();
    if (!name || name.length < 3) {
      alert("Pon el nombre del evento para solicitarlo a soporte 🙏");
      return;
    }
    if (description.trim().length < 6) {
      alert("Agrega una descripción más completa 🙏");
      return;
    }

    setRequestSending(true);
    try {
      // Intentamos traer usuario (si está logueado)
      let userId = null;
      let userEmail = null;
      try {
        const { data } = await supabase.auth.getUser();
        userId = data?.user?.id ?? null;
        userEmail = data?.user?.email ?? null;
      } catch {}

      // ✅ Payload: guarda todo lo ingresado (y deja listo para sumar Paso 2/3 cuando existan)
      const payload = {
        requestEvent: true,
        requestedEventName: name,
        requestedEventExtra: requestedEventExtra.trim() || null,
        userId,
        userEmail,

        // Paso 1 (actual)
        description: description.trim(),
        sector: sector.trim() || null,
        fila: fila.trim() || null,
        asiento: asiento.trim() || null,
        price: price ? Number(price) : null,
        originalPrice: originalPrice ? Number(originalPrice) : null,
        saleType: saleType || null,

        // Placeholder (para cuando sumes Paso 2/3)
        step2: null,
        step3: null,
      };

      const res = await fetch("/api/support/sell-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data?.error || "No se pudo enviar la solicitud 😭");
        return;
      }

      // Si el correo falla pero se guardó en DB, igual es OK
      if (data?.emailSent === false && data?.emailError) {
        alert(
          "Solicitud guardada ✅ (ojo: el correo a soporte falló).\n\nRevisa RESEND_API_KEY / RESEND_FROM."
        );
      } else {
        alert("Listo ✅ Enviamos tu solicitud a soporte. Te avisaremos cuando esté creado el evento.");
      }

      // Limpieza suave (sin tocar estructura)
      setRequestEvent(false);
      setRequestedEventName("");
      setRequestedEventExtra("");
    } finally {
      setRequestSending(false);
    }
  }

  return (
    <div className="tix-section">
      <div className="tix-container">
        {/* Header / title */}
        <div className="tix-card p-6 tix-header-gradient">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="tix-title">Vender entrada</h1>
              <p className="tix-subtitle">Publica tu ticket en 3 pasos, rápido y seguro.</p>
            </div>
            <a href="/market" className="tix-btn-secondary">
              Volver al market
            </a>
          </div>

          {/* Stepper */}
          <div className="mt-6">
            <div className="flex items-center gap-4">
              {steps.map((label, i) => {
                const isActive = i === currentStep;
                const isDone = i < currentStep;
                return (
                  <div key={label} className="flex-1">
                    <div className="flex items-center gap-3">
                      <div
                        className={[
                          "h-10 w-10 rounded-full flex items-center justify-center text-sm font-semibold",
                          isDone
                            ? "bg-white/90 text-slate-900"
                            : isActive
                            ? "bg-white text-slate-900"
                            : "bg-white/40 text-white",
                        ].join(" ")}
                      >
                        {i + 1}
                      </div>
                      <div className="text-white font-semibold">{label}</div>
                    </div>

                    {i < steps.length - 1 && (
                      <div className="mt-4 h-[3px] rounded-full bg-white/25 overflow-hidden">
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
          <p className="mt-1 text-sm text-slate-500">Completa la info básica para publicar tu ticket.</p>

          {/* Evento */}
          <div className="mt-8" ref={dropdownRef}>
            <label className="text-sm font-medium text-slate-700">
              Evento <span className="text-red-500">*</span>
            </label>

            <div className="mt-2 relative">
              <input
                className="tix-input pr-10"
                placeholder={requestEvent ? "Evento no creado (solicitud a soporte)..." : "Busca eventos, artistas, lugares..."}
                value={eventQuery}
                disabled={requestEvent}
                onChange={(e) => {
                  if (requestEvent) return;
                  setEventQuery(e.target.value);

                  if (!eventOpen) setEventOpen(true);
                }}
                onFocus={() => {
                  if (!requestEvent) setEventOpen(true);
                }}
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

            {eventOpen && !requestEvent && (
              <div className="mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
                {eventsLoading ? (
                  <div className="p-4 text-sm text-slate-500">Cargando eventos...</div>
                ) : eventsError ? (
                  <div className="p-4 text-sm text-red-600">
                    {eventsError}
                    <div className="mt-1 text-xs text-slate-500">
                      Tip: revisa RLS o columnas del schema en Supabase.
                    </div>
                  </div>
                ) : filteredEvents.length === 0 ? (
                  <div className="p-4 text-sm text-slate-500">No encontramos eventos con ese texto.</div>
                ) : (
                  <div className="max-h-72 overflow-auto">
                    {filteredEvents.slice(0, 40).map((ev) => {
                      const date = formatEventDate(ev.starts_at);
                      const meta = [date, ev.venue, ev.city].filter(Boolean).join(" · ");
                      const isSelected = selectedEvent?.id === ev.id;

                      return (
                        <button
                          key={ev.id}
                          type="button"
                          onClick={() => {
                            setSelectedEvent(ev);
                            setEventQuery(ev.title);
                            setEventOpen(false);
                          }}
                          className={[
                            "w-full text-left px-4 py-3 hover:bg-slate-50 transition",
                            isSelected ? "bg-slate-50" : "",
                          ].join(" ")}
                        >
                          <div className="text-sm font-semibold text-slate-900">{ev.title}</div>
                          {meta ? <div className="mt-0.5 text-xs text-slate-500">{meta}</div> : null}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

          {/* Solicitar evento (cuando no existe) */}
          <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-start gap-3">
              <input
                id="requestEvent"
                type="checkbox"
                checked={requestEvent}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setRequestEvent(checked);

                  // Si activan solicitud, limpiamos selección y búsqueda
                  if (checked) {
                    setSelectedEvent(null);
                    setEventQuery("");
                    setEventOpen(false);
                  } else {
                    setRequestedEventName("");
                    setRequestedEventExtra("");
                  }
                }}
                className="mt-1 h-4 w-4 accent-indigo-600"
              />

              <div className="min-w-0">
                <label htmlFor="requestEvent" className="block text-sm font-semibold text-slate-900">
                  Evento no creado — solicitar a soporte
                </label>
                <p className="mt-1 text-sm text-slate-600">
                  No se publicará automáticamente. Soporte creará el evento y dejará tu publicación lista con los mismos datos.
                </p>
              </div>
            </div>

            {requestEvent && (
              <div className="mt-4 grid gap-3">
                <div>
                  <label className="text-sm font-medium text-slate-700">
                    Nombre del evento <span className="text-red-500">*</span>
                  </label>
                  <input
                    className="tix-input mt-2"
                    value={requestedEventName}
                    onChange={(e) => setRequestedEventName(e.target.value)}
                    placeholder="Ej: Ricky Martin - Santiago"
                  />
                  <p className="mt-1 text-xs text-slate-500">
                    Tip: agrega ciudad/recinto si lo sabes, para que soporte lo cree más rápido.
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-700">
                    Fecha / Recinto (opcional)
                  </label>
                  <input
                    className="tix-input mt-2"
                    value={requestedEventExtra}
                    onChange={(e) => setRequestedEventExtra(e.target.value)}
                    placeholder="Ej: 12/03/2026, Movistar Arena"
                  />
                </div>
              </div>
            )}
          </div>

          </div>

          {/* Descripción */}
          <div className="mt-8">
            <label className="text-sm font-medium text-slate-700">
              Descripción <span className="text-red-500">*</span>
            </label>
            <textarea
              className="tix-textarea mt-2"
              placeholder="Ej: Entrada General – Platea Alta. Indica ubicación exacta, estado, restricciones, etc."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
            />
          </div>

          {/* Sector / Fila / Asiento */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium text-slate-700">Sector</label>
              <input className="tix-input mt-2" value={sector} onChange={(e) => setSector(e.target.value)} placeholder="Campo / Platea / Galería" />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Fila</label>
              <input className="tix-input mt-2" value={fila} onChange={(e) => setFila(e.target.value)} placeholder="A, B, 1, 2..." />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Asiento</label>
              <input className="tix-input mt-2" value={asiento} onChange={(e) => setAsiento(e.target.value)} placeholder="1, 2, 10..." />
            </div>
          </div>

          {/* Precio */}
          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium text-slate-700">Tipo de venta</label>
              <select className="tix-select mt-2" value={saleType} onChange={(e) => setSaleType(e.target.value)}>
                <option value="fixed">Precio fijo</option>
                <option value="negotiable">Negociable</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Precio de venta</label>
              <input className="tix-input mt-2" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="50000" />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Precio original</label>
              <input className="tix-input mt-2" value={originalPrice} onChange={(e) => setOriginalPrice(e.target.value)} placeholder="60000" />
            </div>
          </div>

          {/* Footer buttons */}
          <div className="mt-10 flex items-center justify-between">
            <button type="button" className="tix-btn-secondary">
              Cancelar
            </button>

            <button
              type="button"
              className="tix-btn-primary"
              disabled={
                requestSending ||
                description.trim().length < 6 ||
                (!requestEvent && !selectedEvent) ||
                (requestEvent && requestedEventName.trim().length < 3)
              }
              title={
                requestEvent
                  ? "Completa nombre del evento y descripción"
                  : "Completa evento y descripción"
              }
              onClick={() => {
                if (requestEvent) {
                  handleRequestSupport();
                } else {
                  // ⚠️ flujo normal (por ahora se mantiene igual)
                }
              }}
            >
              {requestSending ? "Enviando..." : "Continuar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
