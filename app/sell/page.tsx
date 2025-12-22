'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';

type SaleType = 'fixed' | 'auction';

type EventItem = {
  id: string;
  title: string;
  date: string;
  location: string;
};

type FormState = {
  eventId: string;
  description: string;
  sector: string;
  row: string;
  seat: string;
  price: string;
  originalPrice: string;
  saleType: SaleType;
};

const dummyEvents: EventItem[] = [
  {
    id: 'evt_mcr_2026',
    title: 'My Chemical Romance',
    date: '29 de enero de 2026, 21:00',
    location: 'Estadio Bicentenario de La Florida — Santiago, Chile',
  },
  {
    id: 'evt_chay_scl_2026',
    title: 'Chayanne',
    date: '11 de febrero de 2026, 21:00',
    location: 'Estadio Nacional de Chile — Santiago, Chile',
  },
  {
    id: 'evt_doja_2026',
    title: 'Doja Cat',
    date: '10 de febrero de 2026, 21:00',
    location: 'Movistar Arena — Santiago, Chile',
  },
  {
    id: 'evt_lolla_2026',
    title: 'Lollapalooza Chile 2026',
    date: '13–15 de marzo de 2026',
    location: "Parque O'Higgins — Santiago, Chile",
  },
  {
    id: 'evt_acdc_2026',
    title: 'AC/DC',
    date: '20 de marzo de 2026, 21:00',
    location: 'Estadio Monumental — Santiago, Chile',
  },
  {
    id: 'evt_soda_2026',
    title: 'Soda Stereo (Homenaje)',
    date: '5 de abril de 2026, 20:30',
    location: 'Teatro Caupolicán — Santiago, Chile',
  },
];

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

function StepperGradientHeader({
  currentStep,
}: {
  currentStep: 1 | 2 | 3;
}) {
  const steps = [
    { n: 1 as const, label: 'Detalles' },
    { n: 2 as const, label: 'Archivo' },
    { n: 3 as const, label: 'Confirmar' },
  ];

  return (
    <div className="bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-600 px-8 py-7">
      <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
        Vender entrada
      </h1>

      <div className="mt-6 flex items-center w-full">
        {steps.map((s, idx) => {
          const active = s.n === currentStep;
          const done = s.n < currentStep;

          return (
            <React.Fragment key={s.n}>
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    'h-10 w-10 rounded-full flex items-center justify-center font-bold',
                    active && 'bg-white text-blue-600',
                    done && 'bg-white/80 text-blue-700',
                    !active && !done && 'bg-white/25 text-white'
                  )}
                >
                  {s.n}
                </div>
                <div className="text-white font-medium">{s.label}</div>
              </div>

              {idx < steps.length - 1 && (
                <div className="mx-5 flex-1">
                  <div className="h-[2px] w-full bg-white/35" />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

export default function SellPage() {
  const [step, setStep] = useState<1 | 2 | 3>(1);

  const [state, setState] = useState<FormState>({
    eventId: '',
    description: '',
    sector: '',
    row: '',
    seat: '',
    price: '',
    originalPrice: '',
    saleType: 'fixed',
  });

  // ---------- EVENT PICKER (buscador + dropdown pro) ----------
  const events = dummyEvents;

  const [eventQuery, setEventQuery] = useState('');
  const [isEventOpen, setIsEventOpen] = useState(false);
  const eventBoxRef = useRef<HTMLDivElement | null>(null);

  const selectedEvent = useMemo(
    () => events.find((e) => e.id === state.eventId) || null,
    [events, state.eventId]
  );

  const filteredEvents = useMemo(() => {
    const q = eventQuery.trim().toLowerCase();
    if (!q) return events;

    return events.filter((e) => {
      const hay = `${e.title} ${e.location} ${e.date}`.toLowerCase();
      return hay.includes(q);
    });
  }, [events, eventQuery]);

  function pickEvent(eventId: string) {
    const ev = events.find((e) => e.id === eventId);
    setState((prev) => ({ ...prev, eventId }));
    setEventQuery(ev ? ev.title : '');
    setIsEventOpen(false);
  }

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      const el = eventBoxRef.current;
      if (!el) return;
      if (!el.contains(e.target as Node)) setIsEventOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  // ---------- VALIDATION ----------
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validateStep1() {
    const nextErrors: Record<string, string> = {};

    if (!state.eventId) nextErrors.eventId = 'Debes seleccionar un evento.';
    if (!state.description.trim())
      nextErrors.description = 'Describe tu entrada (tipo, ubicación, etc.).';
    if (!state.price || Number(state.price) <= 0)
      nextErrors.price = 'Ingresa un precio de venta válido.';

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  const fieldBase =
    'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500';

  // ---------- UI ----------
  return (
    <div className="min-h-[calc(100vh-64px)] bg-white">
      <div className="mx-auto max-w-5xl px-4 py-10">
        <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-[0_20px_60px_rgba(0,0,0,0.08)]">
          {/* HEADER GRADIENT + STEPPER */}
          <StepperGradientHeader currentStep={step} />

          {/* BODY */}
          <div className="px-8 py-8">
            {step === 1 && (
              <div>
                <h2 className="text-2xl font-bold text-gray-900">
                  Detalles de la entrada
                </h2>

                <div className="mt-6 space-y-5">
                  {/* EVENTO */}
                  <div className="space-y-2" ref={eventBoxRef}>
                    <label className="block text-sm font-medium text-gray-700">
                      Evento *
                    </label>
                    <p className="text-xs text-gray-500 -mt-1">
                      Haz click para desplegar. Escribe para filtrar y selecciona.
                    </p>

                    <div className="relative">
                      <input
                        type="text"
                        value={eventQuery}
                        onChange={(e) => {
                          const v = e.target.value;
                          setEventQuery(v);
                          setIsEventOpen(true);

                          if (selectedEvent && v !== selectedEvent.title) {
                            setState((prev) => ({ ...prev, eventId: '' }));
                          }
                          if (!selectedEvent) {
                            setState((prev) => ({ ...prev, eventId: '' }));
                          }
                        }}
                        onFocus={() => setIsEventOpen(true)}
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') setIsEventOpen(false);
                        }}
                        placeholder="Busca eventos, artistas, lugares..."
                        className={cn(fieldBase, 'pr-10')}
                      />

                      {/* Chevron dentro del input */}
                      <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-blue-600/70">
                        <svg
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="none"
                          aria-hidden="true"
                        >
                          <path
                            d="M7 10l5 5 5-5"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </div>

                      {/* Dropdown */}
                      {isEventOpen && (
                        <div className="absolute z-30 mt-2 w-full overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg">
                          <div className="px-3 py-2 border-b border-gray-100 text-xs text-gray-500">
                            {filteredEvents.length} evento(s)
                          </div>

                          <div className="max-h-72 overflow-auto py-1">
                            {filteredEvents.length === 0 ? (
                              <div className="px-3 py-3 text-sm text-gray-500">
                                No encontramos eventos con “{eventQuery}”.
                              </div>
                            ) : (
                              filteredEvents.map((event) => {
                                const isSelected = state.eventId === event.id;
                                return (
                                  <button
                                    key={event.id}
                                    type="button"
                                    onClick={() => pickEvent(event.id)}
                                    className={cn(
                                      'w-full px-3 py-3 text-left transition',
                                      isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'
                                    )}
                                  >
                                    <div className="text-sm font-semibold text-gray-900">
                                      {event.title}
                                    </div>
                                    <div className="text-xs text-gray-500">
                                      {event.location} • {event.date}
                                    </div>
                                  </button>
                                );
                              })
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {errors.eventId && (
                      <p className="text-xs text-red-600">{errors.eventId}</p>
                    )}
                  </div>

                  {/* DESCRIPCION (único campo, reemplaza título + descripción) */}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Descripción *
                    </label>
                    <textarea
                      value={state.description}
                      onChange={(e) =>
                        setState((prev) => ({ ...prev, description: e.target.value }))
                      }
                      rows={4}
                      placeholder="Ej: Entrada General - Platea Alta. Indica ubicación exacta, estado, restricciones, etc."
                      className={cn(fieldBase, 'resize-y')}
                    />
                    {errors.description && (
                      <p className="text-xs text-red-600">{errors.description}</p>
                    )}
                  </div>

                  {/* SECTOR / FILA / ASIENTO */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Sector
                      </label>
                      <input
                        value={state.sector}
                        onChange={(e) =>
                          setState((prev) => ({ ...prev, sector: e.target.value }))
                        }
                        placeholder="Campo, Platea, etc."
                        className={fieldBase}
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Fila
                      </label>
                      <input
                        value={state.row}
                        onChange={(e) =>
                          setState((prev) => ({ ...prev, row: e.target.value }))
                        }
                        placeholder="A, B, 1, 2, etc."
                        className={fieldBase}
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Asiento
                      </label>
                      <input
                        value={state.seat}
                        onChange={(e) =>
                          setState((prev) => ({ ...prev, seat: e.target.value }))
                        }
                        placeholder="1, 2, 3, etc."
                        className={fieldBase}
                      />
                    </div>
                  </div>

                  {/* PRECIOS */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Precio de venta *
                      </label>
                      <input
                        inputMode="numeric"
                        value={state.price}
                        onChange={(e) =>
                          setState((prev) => ({ ...prev, price: e.target.value }))
                        }
                        placeholder="50000"
                        className={fieldBase}
                      />
                      {errors.price && (
                        <p className="text-xs text-red-600">{errors.price}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Precio original (opcional)
                      </label>
                      <input
                        inputMode="numeric"
                        value={state.originalPrice}
                        onChange={(e) =>
                          setState((prev) => ({
                            ...prev,
                            originalPrice: e.target.value,
                          }))
                        }
                        placeholder="60000"
                        className={fieldBase}
                      />
                    </div>
                  </div>

                  {/* TIPO DE VENTA */}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Tipo de venta
                    </label>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <button
                        type="button"
                        onClick={() =>
                          setState((prev) => ({ ...prev, saleType: 'fixed' }))
                        }
                        className={cn(
                          'rounded-xl border p-4 text-left shadow-sm transition',
                          state.saleType === 'fixed'
                            ? 'border-blue-600 bg-blue-50 ring-2 ring-blue-200'
                            : 'border-gray-200 hover:bg-gray-50'
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-green-600 text-xl">$</span>
                          <span className="font-semibold text-gray-900">
                            Precio fijo
                          </span>
                        </div>
                        <div className="mt-1 text-sm text-gray-600">
                          Vende inmediatamente al precio que estableciste
                        </div>
                      </button>

                      <button
                        type="button"
                        disabled
                        className={cn(
                          'rounded-xl border p-4 text-left shadow-sm transition opacity-70 cursor-not-allowed',
                          'border-gray-200 bg-white'
                        )}
                        title="Próximamente"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-orange-600 text-xl">⏱</span>
                          <span className="font-semibold text-gray-900">
                            Subasta <span className="text-gray-500">(próximamente)</span>
                          </span>
                        </div>
                        <div className="mt-1 text-sm text-gray-600">
                          Deja que los compradores pujen por tu entrada
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* FOOTER ACTIONS */}
                  <div className="pt-4 flex items-center justify-end gap-3">
                    <button
                      type="button"
                      className="rounded-lg border border-gray-200 bg-white px-5 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
                      onClick={() => {
                        // Tu acción real acá (volver/limpiar)
                      }}
                    >
                      Cancelar
                    </button>

                    <button
                      type="button"
                      className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
                      onClick={() => {
                        if (validateStep1()) setStep(2);
                      }}
                    >
                      Continuar
                    </button>
                  </div>

                  <div className="pt-4 text-center text-xs text-gray-400">
                    {events.length} eventos cargados.
                  </div>
                </div>
              </div>
            )}

            {step === 2 && (
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Archivo</h2>
                <p className="mt-2 text-sm text-gray-600">
                  (Acá va el upload del PDF y el “agregar entrada”. Lo dejamos para el
                  siguiente paso)
                </p>

                <div className="pt-6 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    className="rounded-lg border border-gray-200 bg-white px-5 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
                    onClick={() => setStep(1)}
                  >
                    Volver
                  </button>
                  <button
                    type="button"
                    className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
                    onClick={() => setStep(3)}
                  >
                    Continuar
                  </button>
                </div>
              </div>
            )}

            {step === 3 && (
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Confirmar</h2>
                <p className="mt-2 text-sm text-gray-600">
                  (Resumen final + publicar. Lo armamos después)
                </p>

                <div className="pt-6 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    className="rounded-lg border border-gray-200 bg-white px-5 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
                    onClick={() => setStep(2)}
                  >
                    Volver
                  </button>
                  <button
                    type="button"
                    className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
                  >
                    Publicar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
