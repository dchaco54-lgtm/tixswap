'use client';

import { useEffect, useMemo, useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabaseClient';

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

type DbEvent = {
  id: string;
  title: string | null;
  starts_at: string | null;
  venue: string | null;
  city: string | null;
};

function formatEventDisplay(ev: DbEvent) {
  const title = ev.title ?? 'Evento';
  const venue = ev.venue ?? '';
  const city = ev.city ?? '';
  const place = [venue, city].filter(Boolean).join(' · ');

  let dateDisplay = '';
  if (ev.starts_at) {
    const d = new Date(ev.starts_at);
    // Esto funciona bien en Vercel/Node normalmente
    dateDisplay = d.toLocaleString('es-CL', {
      year: 'numeric',
      month: 'long',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } else {
    dateDisplay = 'Fecha por confirmar';
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

  // ✅ Traer eventos reales desde Supabase
  useEffect(() => {
    const loadEvents = async () => {
      setEventsLoading(true);
      try {
        const { data, error } = await supabase
          .from('events')
          .select('id, title, starts_at, venue, city')
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
      // Validaciones
      if (!state.eventId) {
        alert('Selecciona un evento.');
        return;
      }

      const price = Number(state.salePrice);
      if (!Number.isFinite(price) || price <= 0) {
        alert('Ingresa un precio válido.');
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace('/login');
        return;
      }

      const sellerName =
        (user.user_metadata as any)?.full_name ||
        (user.user_metadata as any)?.name ||
        user.email ||
        'Vendedor';

      // ✅ Payload base (probablemente coincide con tu tabla tickets)
      const basePayload: any = {
        event_id: state.eventId,
        sector: state.sector || null,
        row_label: state.row || null,
        seat_label: state.seat || null,
        price,
        seller_name: sellerName,
      };

      // ✅ Payload extendido (si tu tabla tiene estas columnas)
      const extendedPayload: any = {
        ...basePayload,
        title: state.title || null,
        description: state.description || null,
        original_price: state.originalPrice ? Number(state.originalPrice) : null,
        sale_type: state.saleType,
        seller_id: user.id,
        seller_email: user.email,
      };

      // Intento 1: insert extendido
      let { error } = await supabase.from('tickets').insert(extendedPayload);

      // Si falla por columnas no existentes, hacemos fallback al base
      if (error && isMissingColumnError(error)) {
        console.warn('Fallback insert basePayload (faltan columnas en tickets).', error);
        const res2 = await supabase.from('tickets').insert(basePayload);
        error = res2.error ?? null;
      }

      if (error) {
        console.error('Error insert ticket:', error);

        // Mensaje útil para debug
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

      // ✅ Redirigir al "sub-evento" (agrupación)
      router.push(`/events/${state.eventId}`);
    } catch (err: any) {
      console.error(err);
      alert('Ocurrió un error inesperado al crear la publicación.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // UI loading states
  if (authChecking) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="rounded-2xl bg-white px-6 py-4 shadow-sm border border-gray-100 text-sm text-gray-700">
          Revisando sesión...
        </div>
      </main>
    );
  }

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

          {/* Evento */}
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">
              Evento *
            </label>

            {eventsLoading ? (
              <div className="text-sm text-gray-500">Cargando eventos...</div>
            ) : eventOptions.length === 0 ? (
              <div className="text-sm text-red-600">
                No hay eventos en el backend. Crea uno en <b>/admin/events</b>.
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
                placeholder="Cancha, Platea, etc."
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
                placeholder="65000"
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

            <p className="text-xs text-gray-500">
              Para el MVP solo permitimos venta a precio fijo. Más adelante
              activamos la subasta con pre-autorización para que no tengas que
              andar devolviendo plata.
            </p>
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
              disabled={isSubmitting || eventsLoading || eventOptions.length === 0}
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
