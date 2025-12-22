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
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-3xl font-bold text-gray-900">Vender entrada</h1>

      <div className="mt-8 rounded-2xl border border-gray-200 bg-white shadow-sm">
        {/* Steps (no tocar estructura) */}
        <div className="px-6 pt-6">
          <div className="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-white">
                1
              </span>
              <span className="font-medium text-gray-900">Detalles</span>
            </div>

            <div className="flex items-center gap-2 opacity-70">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-200 text-gray-700">
                2
              </span>
              <span>Archivo</span>
            </div>

            <div className="flex items-center gap-2 opacity-70">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-200 text-gray-700">
                3
              </span>
              <span>Confirmar</span>
            </div>
          </div>
        </div>

        <div className="px-6 pb-8 pt-6">
          <h2 className="text-2xl font-semibold text-gray-900">
            Detalles de la entrada
          </h2>

          <form className="mt-6 space-y-6" onSubmit={handleSubmit}>
            {/* EVENTO */}
            <div>
              <label className="block text-sm font-medium text-gray-900">
                Evento <span className="text-red-500">*</span>
              </label>
              <p className="mt-1 text-xs text-gray-500">
                Haz click para desplegar. Escribe para filtrar y selecciona.
              </p>

              {/* ✅ ÚNICO CONTROL visible: input + dropdown (estilo home) */}
              <div className="relative mt-2" ref={eventBoxRef}>
                <div className="relative">
                  <input
                    value={eventQuery}
                    onChange={(e) => {
                      setEventQuery(e.target.value);
                      setIsEventOpen(true);
                    }}
                    onFocus={() => setIsEventOpen(true)}
                    onClick={() => setIsEventOpen((v) => !v)}
                    placeholder="Busca eventos, artistas, lugares..."
                    className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 pr-12 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20"
                    aria-label="Buscar evento"
                    role="combobox"
                    aria-expanded={isEventOpen}
                    aria-controls="event-listbox"
                    autoComplete="off"
                  />

                  {/* Flecha corporativa (recuadro + gradiente) */}
                  <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 shadow-sm">
                    <svg
                      className="h-4 w-4 text-white"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path
                        fillRule="evenodd"
                        d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                </div>

                {/* Select escondido REAL (para accesibilidad + required), pero IMPOSIBLE que se vea */}
                <select
                  name="eventId"
                  value={state.eventId}
                  onChange={(e) => pickEvent(e.target.value)}
                  required
                  className="absolute -left-[9999px] top-0 h-px w-px opacity-0 pointer-events-none"
                  tabIndex={-1}
                  aria-hidden="true"
                >
                  <option value="">Selecciona un evento</option>
                  {EVENTS.map((ev) => (
                    <option key={ev.id} value={ev.id}>
                      {ev.title}
                    </option>
                  ))}
                </select>

                {isEventOpen && (
                  <div
                    className="absolute z-20 mt-2 w-full overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl ring-1 ring-black/5"
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    <div className="border-b border-gray-100 px-4 py-2 text-xs text-gray-500">
                      {filteredEvents.length} evento
                      {filteredEvents.length === 1 ? '' : 's'}
                    </div>

                    <ul
                      id="event-listbox"
                      className="max-h-64 overflow-auto py-1"
                      role="listbox"
                    >
                      {filteredEvents.length === 0 ? (
                        <li className="px-4 py-3 text-sm text-gray-500">
                          No encontramos eventos con ese criterio.
                        </li>
                      ) : (
                        filteredEvents.map((ev) => {
                          const active = ev.id === state.eventId;
                          return (
                            <li key={ev.id} role="option" aria-selected={active}>
                              <button
                                type="button"
                                onClick={() => pickEvent(ev.id)}
                                className={[
                                  'w-full px-4 py-3 text-left',
                                  'hover:bg-blue-50',
                                  active ? 'bg-blue-50' : '',
                                ].join(' ')}
                              >
                                <div className="text-sm font-semibold text-gray-900">
                                  {ev.title}
                                </div>
                                <div className="mt-0.5 text-xs text-gray-600">
                                  {ev.location} • {ev.date}
                                </div>
                              </button>
                            </li>
                          );
                        })
                      )}
                    </ul>
                  </div>
                )}

                {/* “Después” del selector: muestra evento elegido (sin cambiar estructura general) */}
                {selectedEvent && !isEventOpen && (
                  <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                    <div className="text-sm font-semibold text-gray-900">
                      {selectedEvent.title}
                    </div>
                    <div className="mt-0.5 text-xs text-gray-600">
                      {selectedEvent.location} • {selectedEvent.date}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Título */}
            <div>
              <label className="block text-sm font-medium text-gray-900">
                Título de la entrada <span className="text-red-500">*</span>
              </label>
              <input
                name="title"
                value={state.title}
                onChange={handleChange}
                placeholder="Ej: Entrada General - Platea Alta"
                className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20"
                required
              />
            </div>

            {/* Descripción */}
            <div>
              <label className="block text-sm font-medium text-gray-900">
                Descripción
              </label>
              <textarea
                name="description"
                value={state.description}
                onChange={handleChange}
                placeholder="Describe tu entrada (ubicación específica, estado, restricciones, etc.)"
                className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20"
                rows={4}
              />
            </div>

            {/* Sector/Fila/Asiento */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <label className="block text-sm font-medium text-gray-900">
                  Sector
                </label>
                <input
                  name="sector"
                  value={state.sector}
                  onChange={handleChange}
                  placeholder="Campo, Platea, etc."
                  className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-900">
                  Fila
                </label>
                <input
                  name="row"
                  value={state.row}
                  onChange={handleChange}
                  placeholder="A, B, 1, 2, etc."
                  className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-900">
                  Asiento
                </label>
                <input
                  name="seat"
                  value={state.seat}
                  onChange={handleChange}
                  placeholder="1, 2, 3, etc."
                  className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
            </div>

            {/* Precios */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-900">
                  Precio de venta <span className="text-red-500">*</span>
                </label>
                <input
                  name="salePrice"
                  value={state.salePrice}
                  onChange={handleChange}
                  placeholder="50000"
                  inputMode="numeric"
                  className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-900">
                  Precio original (opcional)
                </label>
                <input
                  name="originalPrice"
                  value={state.originalPrice}
                  onChange={handleChange}
                  placeholder="60000"
                  inputMode="numeric"
                  className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
            </div>

            {/* Tipo de venta */}
            <div>
              <label className="block text-sm font-medium text-gray-900">
                Tipo de venta
              </label>

              <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
                <button
                  type="button"
                  onClick={() =>
                    setState((p) => ({ ...p, saleType: 'fixed' }))
                  }
                  className={[
                    'rounded-xl border p-4 text-left transition',
                    state.saleType === 'fixed'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 bg-white hover:bg-gray-50',
                  ].join(' ')}
                >
                  <div className="text-sm font-semibold text-gray-900">
                    💲 Precio fijo
                  </div>
                  <div className="mt-1 text-xs text-gray-600">
                    Vende inmediatamente al precio que estableciste
                  </div>
                </button>

                <button
                  type="button"
                  disabled
                  className="cursor-not-allowed rounded-xl border border-gray-200 bg-gray-50 p-4 text-left opacity-70"
                >
                  <div className="text-sm font-semibold text-gray-900">
                    ⏱️ Subasta <span className="text-gray-500">(próximamente)</span>
                  </div>
                  <div className="mt-1 text-xs text-gray-600">
                    Deja que los compradores pujen por tu entrada
                  </div>
                </button>
              </div>
            </div>

            {/* Botón continuar (mvp) */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                className="rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                onClick={() => history.back()}
              >
                Cancelar
              </button>

              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {isSubmitting ? 'Guardando...' : 'Continuar'}
              </button>
            </div>
          </form>

          <div className="mt-8 text-center text-xs text-gray-400">
            {EVENTS.length} eventos cargados.
          </div>
        </div>
      </div>
    </div>
  );
}
