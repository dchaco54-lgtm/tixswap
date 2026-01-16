"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation"; // ✅ agregado (solo lógica)
import { supabase } from "@/lib/supabaseClient";

const DRAFT_KEY = "tixswap_sell_draft_v1"; // ✅ agregado (solo lógica)

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
  const router = useRouter(); // ✅ agregado (solo lógica)

  const steps = ["Detalles", "Archivo", "Confirmar"];
  const [currentStep] = useState(0);
  const [checkingAuth, setCheckingAuth] = useState(true);

  const [events, setEvents] = useState([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [eventsError, setEventsError] = useState(null);

  const [eventQuery, setEventQuery] = useState("");
  const [eventOpen, setEventOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const dropdownRef = useRef(null);

  // ✅ Solicitud de evento a soporte
  const [requestEvent, setRequestEvent] = useState(false);
  const [requestedEventName, setRequestedEventName] = useState("");
  const [requestedEventExtra, setRequestedEventExtra] = useState("");
  const [requestSending, setRequestSending] = useState(false);

  const [description, setDescription] = useState("");
  const [sector, setSector] = useState("");
  const [fila, setFila] = useState("");
  const [asiento, setAsiento] = useState("");
  const [price, setPrice] = useState("50000");
  const [originalPrice, setOriginalPrice] = useState("60000");

  // Tipo de venta en cards (se mantiene)
  const [saleType, setSaleType] = useState("fixed");

  // Verificar autenticación al cargar la página
  useEffect(() => {
    async function checkAuth() {
      try {
        const { data: { session }, error: sessionErr } = await supabase.auth.getSession();
        
        if (sessionErr) {
          console.error('Error obteniendo sesión:', sessionErr);
        }
        
        if (!session) {
          // No hay sesión, redirigir a login
          router.replace(`/login?redirectTo=${encodeURIComponent('/sell')}`);
          return;
        }
        
        setCheckingAuth(false);
      } catch (err) {
        console.error('Error verificando sesión:', err);
        // Solo redirigir si hay un error crítico, no por timeout
        if (err.message && !err.message.includes('timeout')) {
          router.replace(`/login?redirectTo=${encodeURIComponent('/sell')}`);
        } else {
          setCheckingAuth(false);
        }
      }
    }

    checkAuth();
  }, [router]);

  useEffect(() => {
    let alive = true;

    async function loadEvents() {
      setEventsLoading(true);
      setEventsError(null);

      const { data, error } = await supabase.from("events").select("*").limit(300);

      if (!alive) return;

      if (error) {
        console.error("[sell] supabase events error:", error);
        setEvents([]);
        setEventsError(error.message || "Error cargando eventos");
        setEventsLoading(false);
        return;
      }

      const normalized = (data || []).map(normalizeEventRow);

      // Ordenamos en JS (no dependemos de starts_at en SQL)
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

  async function handleRequestSupport() {
    if (requestSending) return;

    const name = requestedEventName.trim();
    if (!name || name.length < 3) {
      alert("Pon el nombre del evento para solicitarlo a soporte 🙏");
      return;
    }

    if (description.trim().length < 6) {
      alert("Completa la descripción (mínimo 6 caracteres) 🙏");
      return;
    }

    setRequestSending(true);
    try {
      let userId = null;
      let userEmail = null;

      try {
        const { data } = await supabase.auth.getUser();
        userId = data?.user?.id ?? null;
        userEmail = data?.user?.email ?? null;
      } catch {}

      const payload = {
        requestEvent: true,
        requestedEventName: name,
        requestedEventExtra: requestedEventExtra.trim() || null,
        userId,
        userEmail,

        // Paso 1 completo
        description: description.trim(),
        sector: sector.trim() || null,
        fila: fila.trim() || null,
        asiento: asiento.trim() || null,
        saleType: saleType || "fixed",
        price: price ? Number(price) : null,
        originalPrice: originalPrice ? Number(originalPrice) : null,

        // placeholder para cuando amarramos paso 2/3 real
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

      if (data?.emailSent === false && data?.emailError) {
        alert("Solicitud guardada ✅ (ojo: el correo a soporte falló). Revisa RESEND_API_KEY/RESEND_FROM.");
      } else {
        alert("Listo ✅ Enviamos tu solicitud a soporte. Te avisaremos cuando esté creado el evento.");
      }

      // limpieza suave
      setRequestEvent(false);
      setRequestedEventName("");
      setRequestedEventExtra("");
    } finally {
      setRequestSending(false);
    }
  }

  const canContinueNormal = !!selectedEvent && description.trim().length >= 6;
  const canContinueRequest = requestedEventName.trim().length >= 3 && description.trim().length >= 6;

  // Mostrar cargando mientras verifica autenticación
  if (checkingAuth) {
    return (
      <div className="min-h-[calc(100vh-64px)] bg-slate-50 px-4 py-8">
        <div className="mx-auto max-w-5xl">
          <div className="tix-card p-8 text-center">
            <p className="text-gray-600">Verificando sesión…</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-64px)] bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-5xl">
        {/* Stepper (sólido) */}
        <div className="mb-8 overflow-hidden rounded-3xl shadow-soft">
          <div className="bg-gradient-to-r from-blue-500 to-purple-500 px-8 py-10">
            {/* ✅ Link texto arriba, blanco y chico (como tú querías) */}
            <a href="/" className="inline-flex items-center gap-2 text-sm font-medium text-white/90 hover:text-white">
              <span aria-hidden>←</span>
              Volver al inicio
            </a>

            <h1 className="mt-3 text-4xl font-bold text-white">Vender entrada</h1>

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
                  setEventOpen(true);
                }}
                onFocus={() => {
                  if (requestEvent) return;
                  setEventOpen(true);
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
                      const meta = [ev.venue, ev.city, ev.country, formatEventDate(ev.starts_at)]
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

            {/* ✅ Checkbox solicitud evento (debajo del input, con buen spacing) */}
            <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-start gap-3">
                <input
                  id="requestEvent"
                  type="checkbox"
                  checked={requestEvent}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setRequestEvent(checked);

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
                  </div>

                  <div>
                    <label className="text-sm font-medium text-slate-700">Fecha / Recinto (opcional)</label>
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
              <input className="tix-input mt-2" placeholder="Campo, Platea, etc." value={sector} onChange={(e) => setSector(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Fila</label>
              <input className="tix-input mt-2" placeholder="A, B, 1, 2, etc." value={fila} onChange={(e) => setFila(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Asiento</label>
              <input className="tix-input mt-2" placeholder="1, 2, 3, etc." value={asiento} onChange={(e) => setAsiento(e.target.value)} />
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

          {/* Tipo de venta (cards como tu diseño) */}
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
                <div className="mt-1 text-sm text-slate-600">Vende inmediatamente al precio que estableciste</div>
              </button>

              <button
                type="button"
                disabled
                className="cursor-not-allowed rounded-2xl border border-slate-200 bg-slate-50 p-5 text-left"
                title="Pronto estará disponible"
              >
                <div className="font-semibold text-slate-900">Subasta</div>
                <div className="mt-1 text-sm text-slate-600">
                  Pronto estará disponible. Deja que los compradores pujen por tu entrada.
                </div>
              </button>
            </div>

            {/* ✅ Subasta automática (deshabilitado + “Se viene pronto”) */}
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-5">
              <div className="flex items-start gap-3">
                <input type="checkbox" disabled className="mt-1 h-4 w-4 cursor-not-allowed accent-amber-500" />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 font-semibold text-amber-900">
                    <span>Subasta automática de emergencia</span>
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                      Se viene pronto
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-amber-800">
                    Si mi entrada no se vende, permitir que se active automáticamente una subasta 2 horas antes del evento.
                    Los compradores podrán pujar y se enviará un email a cada uno cuando sea superado.
                  </p>
                </div>
              </div>
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
              disabled={requestSending || (!requestEvent ? !canContinueNormal : !canContinueRequest)}
              title={requestEvent ? "Completa nombre del evento y descripción" : "Completa evento y descripción"}
              onClick={() => {
                if (requestEvent) {
                  handleRequestSupport();
                  return;
                }

                // ✅ PASO 5: guardar draft + ir a Paso 2 (Archivo)
                const draft = {
                  step: 1,
                  event_id: selectedEvent?.id,
                  event_title: selectedEvent?.title || null,

                  description: description.trim(),
                  sector: sector.trim() || null,
                  fila: fila.trim() || null,
                  asiento: asiento.trim() || null,

                  saleType: saleType || "fixed",
                  price: price ? Number(price) : null,
                  originalPrice: originalPrice ? Number(originalPrice) : null,
                };

                localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
                router.push("/sell/file");
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
