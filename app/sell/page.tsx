'use client';

import React, { useState, FormEvent, ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';

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

  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    const { name, value, type, checked } = e.target as any;

    setState((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleCancel = () => {
    // Para que SIEMPRE haga algo: ir al home
    router.push('/');
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // MVP: solo mostramos en consola
      console.log('Publicación a guardar:', state);

      alert('Tu entrada fue creada (MVP: falta conectar al backend).');

      // Redirigimos al home (después esto podría ser /account o /dashboard)
      router.push('/');
    } catch (err) {
      console.error(err);
      alert('Ocurrió un error al crear la publicación.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-10">
      <div className="mx-auto max-w-3xl px-4">
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

        {/* Formulario */}
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
            <select
              name="eventId"
              value={state.eventId}
              onChange={handleChange}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
              required
            >
              <option value="">Selecciona un evento</option>
              {/* TODO: poblar con eventos reales de tu BD */}
              <option value="1">Ejemplo: Santiago Rocks 2026</option>
              <option value="2">Ejemplo: Lollapalooza Chile 2026</option>
            </select>
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
            <p className="text-xs text-gray-500">
              Para el MVP solo permitimos venta a precio fijo. Más adelante
              activamos la subasta con pre-autorización para que no tengas que
              andar devolviendo plata.
            </p>
          </div>

          {/* Subasta emergencia (UI futura) */}
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
                  subasta pocas horas antes del evento. Te avisaremos por correo
                  cada vez que tu oferta sea superada.
                </p>
              </div>
            </div>
          </div>

          {/* Botones */}
          <div className="flex justify-between pt-4">
            <button
              type="button"
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              onClick={handleCancel}
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

