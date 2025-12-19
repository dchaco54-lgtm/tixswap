'use client';

import { useEffect, useMemo, useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabaseClient';

type SaleType = 'fixed' | 'auction';

type DbEvent = {
  id: string;
  title: string | null;
  starts_at: string | null;
  venue: string | null;
  city: string | null;
  category?: string | null;
};

interface SellFormState {
  // Caso 1
  eventId: string;

  // Caso 2
  useCustomEvent: boolean;
  customEventTitle: string;
  customEventDateTime: string; // datetime-local
  customEventVenue: string;
  customEventCity: string;
  customEventCategory: string;

  // Ticket
  title: string;
  description: string;
  sector: string;
  row: string;
  seat: string;
  salePrice: string;
  originalPrice: string;
  saleType: SaleType;
}

function formatEventDisplay(ev: DbEvent) {
  const title = ev.title ?? 'Evento';
  const venue = ev.venue ?? '';
  const city = ev.city ?? '';
  const place = [venue, city].filter(Boolean).join(' · ');

  let dateDisplay = 'Fecha por confirmar';
  if (ev.starts_at) {
    const d = new Date(ev.starts_at);
    dateDisplay = d.toLocaleString('es-CL', {
      year: 'numeric',
      month: 'long',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  return `${title} — ${dateDisplay}${place ? ` — ${place}` : ''}`;
}

function isMissingColumnError(err: any) {
  const msg = String(err?.message || '').toLowerCase();
  const code = String(err?.code || '');
  return code === '42703' || (msg.includes('column') && msg.includes('does not exist'));
}

export default function SellPage() {
  return <SellForm />;
}

function SellForm() {
  const router = useRouter();
  const [step] = useState(1);

  const [authChecking, setAuthChecking] = useState(true);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [events, setEvents] = useState<DbEvent[]>([]);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const [state, setState] = useState<SellFormState>({
    eventId: '',

    useCustomEvent: false,
    customEventTitle: '',
    customEventDateTime: '',
    customEventVenue: '',
    customEventCity: '',
    customEventCategory: '',

    title: '',
    description: '',
    sector: '',
    row: '',
    seat: '',
    salePrice: '',
    originalPrice: '',
    saleType: 'fixed',
  });

  // ✅ Exigir login
  useEffect(() => {
    const initAuth = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          router.replace('/login');
          return;
        }
      } finally {
        setAuthChecking(false);
      }
    };

    initAuth();
  }, [router]);

  // ✅ Traer eventos desde Supabase
  useEffect(() => {
    const loadEvents = async () => {
      setEventsLoading(true);
      try {
        const { data, error } = await supabase
          .from('events')
          .select('id, title, starts_at, venue, city, category')
          .order('starts_at', { ascending: true });

        if (error) {
          console.error('Error cargando events:', error);
          setEvents([]);
          return;
        }

        setEvents((data as DbEvent[]) ?? []);
      } finally {
        setEventsLoading(false);
      }
    };

    loadEvents();
  }, []);

  const eventOptions = useMemo(() => {
    return events.map((ev) => ({
      id: ev.id,
      label: formatEventDisplay(ev),
    }));
  }, [events]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    const { name, value, type, checked } = e.target as any;
    setState((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace('/login');
        return;
      }

      // Validaciones ticket
      const price = Number(state.salePrice);
      if (!state.title.trim()) {
        alert('Ingresa el título de la entrada.');
        return;
      }
      if (!Number.isFinite(price) || price <= 0) {
        alert('Ingresa un precio de venta válido.');
        return;
      }

      const sellerName =
        (user.user_metadata as any)?.full_name ||
        (user.user_metadata as any)?.name ||
        user.email ||
        'Vendedor';

      // ============================
      // CASO 2: Evento NO está en listado
      // ============================
      if (state.useCustomEvent) {
        if (!state.customEventTitle.trim()) {
          alert('Ingresa el nombre del evento.');
          return;
        }
        if (!state.customEventDateTime) {
          alert('Ingresa fecha y hora del evento (aunque sea aproximada).');
          return;
        }

        const msgLines = [
          `SOLICITUD NUEVO EVENTO + PUBLICACIÓN`,
          ``,
          `Usuario: ${user.email || ''}`,
          `User ID: ${user.id}`,
          ``,
          `EVENTO SOLICITADO`,
          `- Título: ${state.customEventTitle.trim()}`,
          `- Fecha/Hora: ${state.customEventDateTime}`,
          `- Recinto: ${state.customEventVenue.trim() || '(no informado)'}`,
          `- Ciudad: ${state.customEventCity.trim() || '(no informado)'}`,
          `- Categoría: ${state.customEventCategory.trim() || '(no informado)'}`,
          ``,
          `ENTRADA A PUBLICAR (pendiente de validación/creación del evento)`,
          `- Título entrada: ${state.title.trim()}`,
          `- Descripción: ${state.description.trim() || '(sin descripción)'}`,
          `- Sector: ${state.sector.trim() || '-'}`,
          `- Fila: ${state.row.trim() || '-'}`,
          `- Asiento: ${state.seat.trim() || '-'}`,
          `- Precio venta: ${price}`,
          `- Precio original: ${state.originalPrice ? Number(state.originalPrice) : '(no informado)'}`,
          `- Tipo venta: ${state.saleType}`,
          ``,
          `NOTA SOPORTE`,
          `Crear evento en /admin/events y luego publicar esta entrada bajo ese evento.`,
        ];

        const { error } = await supabase.from('support_tickets').insert([
          {
            user_id: user.id,
            category: 'event_request',
            subject: `Crear evento: ${state.customEventTitle.trim()} (y publicar entrada)`,
            message: msgLines.join('\n'),
            // status default 'open'
          },
        ]);

        if (error) {
          console.error(error);
          alert('No se pudo enviar la solicitud a soporte. Intenta nuevamente.');
          return;
        }

        alert('Listo ✅ Enviamos la solicitud a soporte. Te avisaremos cuando el evento esté creado y tu entrada publicada.');
        router.push('/dashboard/tickets');
        return;
      }

      // ============================
      // CASO 1: Evento existe
      // ============================
      if (!state.eventId) {
        alert('Selecciona un evento.');
        return;
      }

      const basePayload: any = {
        event_id: state.eventId,
        sector: state.sector || null,
        row_label: state.row || null,
        seat_label: state.seat || null,
        price,
        seller_name: sellerName,
      };

      const extendedPayload: any = {
        ...basePayload,
        title: state.title || null,
        description: state.description || null,
        original_price: state.originalPrice ? Number(state.originalPrice) : null,
        sale_type: state.saleType,
        seller_id: user.id,
        seller_email: user.email,
      };

      let { error } = await supabase.from('tickets').insert(extendedPayload);

      if (error && isMissingColumnError(error)) {
        const res2 = await supabase.from('tickets').insert(basePayload);
        error = res2.error ?? null;
      }

      if (error) {
        console.error('Error insert ticket:', error);

        const msg = [
          error.message ? `Mensaje: ${error.message}` : null,
          error.code ? `Code: ${error.code}` : null,
          error.details ? `Details: ${error.details}` : null,
          error.hint ? `Hint: ${error.hint}` : null,
        ]
          .filter(Boolean)
          .join('\n');

        alert(`No se pudo crear la publicación.\n\n${msg}`);
        return;
      }

      router.push(`/events/${state.eventId}`);
    } catch (err) {
      console.error(err);
      alert('Ocurrió un error inesperado.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authChecking) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="rounded-2xl bg-white px-6 py-4 shadow-sm border border-gray-100 text-sm text-gray-700">
          Revisando sesión...
        </div>
      </main>
    );
  }

  const noEvents = !eventsLoading && eventOptions.length === 0;

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

          {/* Toggle Caso 2 */}
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                name="useCustomEvent"
                checked={state.useCustomEvent}
                onChange={handleChange}
                className="mt-1"
              />
              <div>
                <p className="text-sm font-semibold text-gray-900">
                  Mi evento no está en el listado
                </p>
                <p className="text-xs text-gray-600">
                  Puedes enviar la solicitud y soporte creará el evento y publicará tu entrada.
                </p>
              </div>
            </label>
          </div>

          {/* Caso 1: Evento existente */}
          {!state.useCustomEvent && (
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">
                Evento *
              </label>

              {eventsLoading ? (
                <div className="text-sm text-gray-500">Cargando eventos...</div>
              ) : noEvents ? (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  No hay eventos creados todavía. Soporte debe importarlos/crearlos en <b>/admin/events</b>.
                  <div className="mt-2 text-xs text-red-700">
                    Mientras tanto, marca “Mi evento no está en el listado” para enviar solicitud a soporte.
                  </div>
                </div>
              ) : (
                <select
                  name="eventId"
                  value={state.eventId}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                  required
                >
                  <option value="">Selecciona un evento</option>
                  {eventOptions.map((ev) => (
                    <option key={ev.id} value={ev.id}>
                      {ev.label}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* Caso 2: Solicitud evento */}
          {state.useCustomEvent && (
            <div className="rounded-2xl border border-gray-200 p-4 space-y-4">
              <p className="text-sm font-semibold text-gray-900">
                Datos del evento (solicitud a soporte)
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-gray-700">
                    Nombre del evento *
                  </label>
                  <input
                    type="text"
                    name="customEventTitle"
                    value={state.customEventTitle}
                    onChange={handleChange}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    placeholder="Ej: Chayanne (Concepción)"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-sm font-medium text-gray-700">
                    Fecha y hora *
                  </label>
                  <input
                    type="datetime-local"
                    name="customEventDateTime"
                    value={state.customEventDateTime}
                    onChange={handleChange}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-sm font-medium text-gray-700">
                    Recinto
                  </label>
                  <input
                    type="text"
                    name="customEventVenue"
                    value={state.customEventVenue}
                    onChange={handleChange}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    placeholder="Ej: Estadio Ester Roa"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-sm font-medium text-gray-700">
                    Ciudad
                  </label>
                  <input
                    type="text"
                    name="customEventCity"
                    value={state.customEventCity}
                    onChange={handleChange}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    placeholder="Ej: Concepción"
                  />
                </div>

                <div className="space-y-1 md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Categoría (opcional)
                  </label>
                  <input
                    type="text"
                    name="customEventCategory"
                    value={state.customEventCategory}
                    onChange={handleChange}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    placeholder="Pop, Rock, Festival..."
                  />
                </div>
              </div>
            </div>
          )}

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
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
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
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
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
                placeholder="Cancha, Platea, etc."
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
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
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
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
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
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
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
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
                placeholder="65000"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
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
                onClick={() => setState((p) => ({ ...p, saleType: 'fixed' }))}
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
              disabled={isSubmitting || (!state.useCustomEvent && (eventsLoading || eventOptions.length === 0))}
              className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {isSubmitting ? 'Guardando...' : state.useCustomEvent ? 'Enviar a soporte' : 'Publicar'}
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
