'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
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
    setIsSubmitting(true);

    try {
      // 1) Requerimos usuario logueado (MVP). Si no, lo mandamos a login.
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        alert('Primero inicia sesión para publicar una entrada.');
        router.push('/login');
        return;
      }

      const sellerName =
        (user.user_metadata as any)?.full_name ||
        (user.user_metadata as any)?.name ||
        user.email ||
        'Vendedor';

      // 2) Intento "extendido" (si tu tabla tickets tiene más columnas)
      const extendedPayload: any = {
        event_id: state.eventId,
        title: state.title,
        description: state.description || null,
        sector: state.sector || null,
        row_label: state.row || null,
        seat_label: state.seat || null,
        price: Number(state.salePrice),
        original_price: state.originalPrice ? Number(state.originalPrice) : null,
        sale_type: state.saleType, // fixed | auction
        seller_id: user.id,
        seller_email: user.email,
        seller_name: sellerName,
      };

      let { error } = await supabase.from('tickets').insert(extendedPayload);

      // 3) Fallback "medio" (útil si tienes RLS/cols seller_id pero no title/description)
      if (error) {
        const midPayload: any = {
          event_id: state.eventId,
          sector: state.sector || null,
          row_label: state.row || null,
          seat_label: state.seat || null,
          price: Number(state.salePrice),
          original_price: state.originalPrice ? Number(state.originalPrice) : null,
          sale_type: state.saleType,
          seller_id: user.id,
          seller_email: user.email,
          seller_name: sellerName,
        };

        const { error: errorMid } = await supabase.from('tickets').insert(midPayload);
        error = errorMid ?? null;
      }

      // 4) Fallback "simple" (si tu tabla tickets es minimalista)
      if (error) {
        const basePayload: any = {
          event_id: state.eventId,
          sector: state.sector || null,
          row_label: state.row || null,
          seat_label: state.seat || null,
          price: Number(state.salePrice),
          seller_name: sellerName,
        };

        const { error: errorBase } = await supabase.from('tickets').insert(basePayload);
        if (errorBase) throw errorBase;
      }

      // ✅ Sub-evento: redirigimos a la página del evento, donde se agrupan las publicaciones por event_id
      router.push(`/events/${state.eventId}`);
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
        {/* Título */}
        <h1 className="text-2xl font-semibold text-gray-900 mb-6">
          Vender entrada
        </h1>

        {/* Stepper */}
        <div className="mb-8 rounded-2xl bg-gradient-to-r from-indigo-500 to-blue-500 p-[1px]">
          <div className="flex justify-between rounded-2xl bg-white px-6 py-4 text-sm font-medium">
            <StepIndicator label="Detalles" step={1} activeStep={step} />
            <StepIndicator label="Archivo" step={2} activeStep={step} />
            <StepIndicator label="Confirmar" step={3} activeStep={step} />
          </div>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
        >
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Detalles de la entrada
          </h2>

          {/* Evento */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Evento <span className="text-red-500">*</span>
            </label>
            <select
              name="eventId"
              value={state.eventId}
              onChange={handleChange}
              required
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              <option value="" disabled>
                Selecciona un evento...
              </option>
              {EVENTS.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.title} — {event.date} — {event.location}
                </option>
              ))}
            </select>
          </div>

          {/* Título */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Título de la entrada <span className="text-red-500">*</span>
            </label>
            <input
              name="title"
              value={state.title}
              onChange={handleChange}
              required
              placeholder="Ej: Entrada sector cancha (2 unidades)"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          {/* Descripción */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Descripción
            </label>
            <textarea
              name="description"
              value={state.description}
              onChange={handleChange}
              placeholder="Agrega detalles: si es e-ticket, vista, restricciones, etc."
              rows={4}
              className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          {/* Sector / Fila / Asiento */}
          <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Sector
              </label>
              <input
                name="sector"
                value={state.sector}
                onChange={handleChange}
                placeholder="Ej: Cancha"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Fila
              </label>
              <input
                name="row"
                value={state.row}
                onChange={handleChange}
                placeholder="Ej: 12"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Asiento
              </label>
              <input
                name="seat"
                value={state.seat}
                onChange={handleChange}
                placeholder="Ej: 08"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
          </div>

          {/* Precios */}
          <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Precio de venta <span className="text-red-500">*</span>
              </label>
              <input
                name="salePrice"
                value={state.salePrice}
                onChange={handleChange}
                required
                inputMode="numeric"
                placeholder="Ej: 65000"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Precio original (opcional)
              </label>
              <input
                name="originalPrice"
                value={state.originalPrice}
                onChange={handleChange}
                inputMode="numeric"
                placeholder="Ej: 88997"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
          </div>

          {/* Tipo de venta */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Tipo de venta
            </label>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="cursor-pointer">
                <input
                  type="radio"
                  name="saleType"
                  value="fixed"
                  checked={state.saleType === 'fixed'}
                  onChange={handleChange}
                  className="hidden"
                />
                <div
                  className={`rounded-xl border p-4 ${
                    state.saleType === 'fixed'
                      ? 'border-blue-600 bg-blue-50'
                      : 'border-gray-200 bg-white'
                  }`}
                >
                  <p className="font-semibold text-gray-900">Precio fijo</p>
                  <p className="text-sm text-gray-600">
                    Vende inmediatamente al precio que estableces.
                  </p>
                </div>
              </label>

              <label className="cursor-not-allowed opacity-60">
                <input
                  type="radio"
                  name="saleType"
                  value="auction"
                  checked={state.saleType === 'auction'}
                  onChange={handleChange}
                  className="hidden"
                  disabled
                />
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <p className="font-semibold text-gray-900">
                    Subasta (próximamente)
                  </p>
                  <p className="text-sm text-gray-600">
                    Los compradores podrán pujar por tu entrada.
                  </p>
                </div>
              </label>
            </div>

            <p className="mt-2 text-xs text-gray-500">
              Para el MVP solo permitimos venta a precio fijo. Más adelante
              activamos la subasta con pre-autorización para que no tengas que
              andar devolviendo plata.
            </p>

            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <label className="flex items-start gap-3 text-sm text-gray-700">
                <input
                  type="checkbox"
                  name="emergencyAuction"
                  checked={state.emergencyAuction}
                  onChange={handleChange}
                  disabled
                  className="mt-1"
                />
                <span>
                  <span className="font-semibold">
                    Subasta automática de emergencia (próximamente)
                  </span>
                  <br />
                  Si tu entrada no se vende, se activará automáticamente una
                  subasta pocas horas antes del evento. Te avisaremos por correo
                  cada vez que tu oferta sea superada.
                </span>
              </label>
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
          isCompleted
            ? 'bg-emerald-600 text-white'
            : isActive
            ? 'bg-blue-600 text-white'
            : 'bg-gray-200 text-gray-700'
        }`}
      >
        {step}
      </div>
      <span
        className={`${
          isActive ? 'text-gray-900' : 'text-gray-600'
        }`}
      >
        {label}
      </span>
    </div>
  );
}
