'use client';

import { useState, FormEvent, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { EVENTS } from '../lib/events';

type SaleType = 'fixed' | 'auction';

interface SellFormState {
  eventId: string;
  title: string;
  description: string;
  sector: string;
  row: string;
  seat: string;
  salePrice: string;
  originalPrice: string;
  saleType: SaleType;
  emergencyAuction: boolean;
}

export default function SellPage() {
  return <SellForm />;
}

function SellForm() {
  const router = useRouter();
  const [step] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [state, setState] = useState<SellFormState>({
    eventId: '',
    title: '',
    description: '',
    sector: '',
    row: '',
    seat: '',
    salePrice: '',
    originalPrice: '',
    saleType: 'fixed',
    emergencyAuction: false,
  });

  // ✅ Event combobox (UN SOLO CONTROL, estilo home)
  const [eventQuery, setEventQuery] = useState('');
  const [isEventOpen, setIsEventOpen] = useState(false);
  const eventBoxRef = useRef<HTMLDivElement | null>(null);

  const selectedEvent = useMemo(
    () => EVENTS.find((e) => e.id === state.eventId) || null,
    [state.eventId],
  );

  const filteredEvents = useMemo(() => {
    const q = eventQuery.trim().toLowerCase();
    if (!q) return EVENTS;
    return EVENTS.filter((ev) => {
      const hay = `${ev.title} ${ev.date} ${ev.location}`.toLowerCase();
      return hay.includes(q);
    });
  }, [eventQuery]);

  // si hay evento seleccionado, el input muestra el título (pero sin romper filtrado)
  useEffect(() => {
    if (selectedEvent && !isEventOpen) {
      setEventQuery(selectedEvent.title);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.eventId]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!eventBoxRef.current) return;
      if (!eventBoxRef.current.contains(e.target as Node)) {
        setIsEventOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const pickEvent = (eventId: string) => {
    const ev = EVENTS.find((x) => x.id === eventId);
    setState((prev) => ({ ...prev, eventId }));
    setEventQuery(ev?.title ?? '');
    setIsEventOpen(false);
  };

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    const { name, value, type, checked } = e.target as any;
    setState((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!state.eventId) {
      alert('Selecciona un evento antes de continuar.');
      return;
    }

    setIsSubmitting(true);
    try {
      console.log('Publicación a guardar:', state);
      alert('Tu entrada fue creada (MVP: falta conectar al backend).');
      // router.push('/panel');
    } catch (err) {
      console.error(err);
      alert('Ocurrió un error al crear la publicación.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-10">
      <div className="mx-auto max-w-5xl px-4">
        <h1 className="text-2xl font-semibold text-gray-900 mb-6">
          Vender entrada
        </h1>

        <div className="mb-8 rounded-2xl bg-gradient-to-r from-indigo-500 to-blue-500 p-[1px]">
          <div className="flex justify-between rounded-2xl bg-white px-6 py-4 text-sm font-medium">
            <StepIndicator label="Detalles" step={1} activeStep={step} />
            <StepIndicator label="Archivo" step={2} activeStep={step} />
            <StepIndicator label="Confirmar" step={3} activeStep={step} />
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl bg-white shadow-sm border border-gray-100 p-6 space-y-6"
        >
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            Detalles de la entrada
          </h2>

          {/* ✅ EVENTO: SOLO BUSCADOR + DROPDOWN PRO (sin select feo visible) */}
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

                  // Solo borra selección si el usuario escribió algo distinto al título del seleccionado
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
                className="w-full rounded-lg border border-gray-300 px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />

              {/* Chevron dentro del input (deja claro que es desplegable) */}
              <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
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

              {/* Dropdown con ESPACIO antes y después */}
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
                            className={`w-full px-3 py-3 text-left transition ${
                              isSelected
                                ? 'bg-blue-50'
                                : 'hover:bg-gray-50'
                            }`}
                          >
                            <div className="text-sm font-semibold text-gray-900">
                              {event.title}
                            </div>
                            <div className="text-xs text-gray-500">
                              {event.date} — {event.location}
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* ✅ Hidden select SOLO para required del form (NO se ve, NO rompe UX) */}
            <select
              name="eventId"
              value={state.eventId}
              onChange={handleChange}
              required
              tabIndex={-1}
              aria-hidden="true"
              className="sr-only"
            >
              <option value="">Selecciona un evento</option>
              {EVENTS.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.title} — {event.date} — {event.location}
                </option>
              ))}
            </select>

            {/* Espacio “post” y confirmación visual suave */}
            {selectedEvent && (
              <div className="mt-3 rounded-lg border border-gray-200 bg-white px-3 py-2">
                <div className="text-sm font-semibold text-gray-900">
                  {selectedEvent.title}
                </div>
                <div className="text-xs text-gray-500">
                  {selectedEvent.date} — {selectedEvent.location}
                </div>
              </div>
            )}
          </div>

          {/* Título entrada */}
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">
              Título de la entrada *
            </label>
            <input
              type="text"
              name="title"
              value={state.title}
              onChange={handleChange}
              placeholder="Ej: Entrada General - Platea Alta"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>

          {/* Descripción */}
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">
              Descripción
            </label>
            <textarea
              name="description"
              value={state.description}
              onChange={handleChange}
              rows={3}
              placeholder="Describe tu entrada (ubicación específica, estado, restricciones, etc.)"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Sector / Fila / Asiento */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">
                Sector
              </label>
              <input
                type="text"
                name="sector"
                value={state.sector}
                onChange={handleChange}
                placeholder="Campo, Platea, etc."
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">
                Fila
              </label>
              <input
                type="text"
                name="row"
                value={state.row}
                onChange={handleChange}
                placeholder="A, B, 1, 2, etc."
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">
                Asiento
              </label>
              <input
                type="text"
                name="seat"
                value={state.seat}
                onChange={handleChange}
                placeholder="1, 2, 3, etc."
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Precios */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">
                Precio de venta *
              </label>
              <input
                type="number"
                min={0}
                name="salePrice"
                value={state.salePrice}
                onChange={handleChange}
                placeholder="50000"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">
                Precio original (opcional)
              </label>
              <input
                type="number"
                min={0}
                name="originalPrice"
                value={state.originalPrice}
                onChange={handleChange}
                placeholder="60000"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Tipo de venta */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700">
              Tipo de venta
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() =>
                  setState((prev) => ({ ...prev, saleType: 'fixed' }))
                }
                className={`flex flex-col items-start rounded-xl border px-4 py-3 text-left text-sm transition ${
                  state.saleType === 'fixed'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 bg-white hover:bg-gray-50'
                }`}
              >
                <span className="font-semibold text-gray-900">Precio fijo</span>
                <span className="text-gray-500 text-xs">
                  Vende inmediatamente al precio que estableces.
                </span>
              </button>

              <button
                type="button"
                disabled
                className="flex flex-col items-start rounded-xl border border-gray-200 px-4 py-3 text-left text-sm bg-gray-50 cursor-not-allowed opacity-60"
              >
                <span className="font-semibold text-gray-900">
                  Subasta (próximamente)
                </span>
                <span className="text-gray-500 text-xs">
                  Los compradores podrán pujar por tu entrada.
                </span>
              </button>
            </div>
          </div>

          {/* Subasta emergencia (deshabilitada por ahora) */}
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800 space-y-2 opacity-60 cursor-not-allowed">
            <div className="flex items-start gap-2">
              <input
                type="checkbox"
                disabled
                name="emergencyAuction"
                checked={state.emergencyAuction}
                onChange={handleChange}
                className="mt-[2px]"
              />
              <div>
                <p className="font-semibold">
                  Subasta automática de emergencia (próximamente)
                </p>
                <p>
                  Si tu entrada no se vende, se activará automáticamente una
                  subasta pocas horas antes del evento.
                </p>
              </div>
            </div>
          </div>

          {/* Botones */}
          <div className="flex justify-between pt-4">
            <button
              type="button"
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              onClick={() => router.back()}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {isSubmitting ? 'Guardando...' : 'Continuar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface StepProps {
  label: string;
  step: number;
  activeStep: number;
}

function StepIndicator({ label, step, activeStep }: StepProps) {
  const isActive = step === activeStep;
  const isCompleted = step < activeStep;

  return (
    <div className="flex items-center gap-2">
      <div
        className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
          isActive
            ? 'bg-blue-600 text-white'
            : isCompleted
            ? 'bg-green-500 text-white'
            : 'bg-gray-200 text-gray-600'
        }`}
      >
        {step}
      </div>
      <span
        className={`text-sm ${
          isActive ? 'text-gray-900 font-semibold' : 'text-gray-500'
        }`}
      >
        {label}
      </span>
    </div>
  );
}
