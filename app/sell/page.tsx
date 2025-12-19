'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

type EventRow = {
  id: string;
  name: string;
  date: string;
  location: string;
  category?: string | null;
  image_url?: string | null;
};

export default function SellPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const redirectTo = searchParams.get('redirectTo') || '/sell';

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Wizard
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Events
  const [events, setEvents] = useState<EventRow[]>([]);
  const [eventId, setEventId] = useState('');
  const [eventNotListed, setEventNotListed] = useState(false);
  const [newEventName, setNewEventName] = useState('');
  const [newEventDate, setNewEventDate] = useState('');
  const [newEventLocation, setNewEventLocation] = useState('');

  // Ticket fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [sector, setSector] = useState('');
  const [row, setRow] = useState('');
  const [seat, setSeat] = useState('');
  const [price, setPrice] = useState('');
  const [originalPrice, setOriginalPrice] = useState('');

  // File
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      setError(null);

      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        router.push(`/login?redirectTo=${encodeURIComponent(redirectTo)}`);
        return;
      }

      const { data, error: eventsError } = await supabase
        .from('events')
        .select('id,name,date,location,category,image_url')
        .order('date', { ascending: true });

      if (eventsError) {
        setError('No pude cargar los eventos. Intenta de nuevo.');
      } else {
        setEvents((data || []) as EventRow[]);
      }

      setLoading(false);
    };

    init();
  }, [router, redirectTo]);

  const eventOptions = useMemo(() => {
    return events.map((e) => ({
      value: e.id,
      label: `${e.name} — ${new Date(e.date).toLocaleDateString('es-CL')} · ${e.location}`,
    }));
  }, [events]);

  const canGoStep2 = useMemo(() => {
    if (eventNotListed) {
      return Boolean(newEventName.trim() && newEventDate && newEventLocation.trim() && title.trim() && price);
    }
    return Boolean(eventId && title.trim() && price);
  }, [eventNotListed, newEventName, newEventDate, newEventLocation, eventId, title, price]);

  const canSubmit = useMemo(() => {
    // File is optional for now (pero recomendado)
    return true;
  }, []);

  const money = (s: string) => {
    const n = Number(String(s).replace(/[^0-9]/g, ''));
    if (!Number.isFinite(n) || n <= 0) return null;
    return n;
  };

  const onNext = () => {
    setError(null);
    setSuccess(null);
    if (step === 1) {
      if (!canGoStep2) {
        setError('Te falta completar lo básico: evento + título + precio.');
        return;
      }
      setStep(2);
      return;
    }
    if (step === 2) {
      setStep(3);
    }
  };

  const onBack = () => {
    setError(null);
    setSuccess(null);
    if (step === 3) return setStep(2);
    if (step === 2) return setStep(1);
  };

  const handleSubmit = async () => {
    setError(null);
    setSuccess(null);
    setSubmitting(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;
      if (!session) {
        router.push(`/login?redirectTo=${encodeURIComponent(redirectTo)}`);
        return;
      }

      const user = session.user;
      const sellerName =
        user?.user_metadata?.name || user?.user_metadata?.full_name || user?.email || 'Usuario';

      // 1) Create event if not listed
      let finalEventId = eventId;
      if (eventNotListed) {
        const { data: createdEvent, error: createEventError } = await supabase
          .from('events')
          .insert({
            name: newEventName.trim(),
            date: newEventDate,
            location: newEventLocation.trim(),
            category: 'Pendiente',
          })
          .select('id')
          .single();

        if (createEventError) {
          throw new Error('No pude crear el evento.');
        }
        finalEventId = createdEvent.id;

        // Aviso a soporte
        await supabase.from('support_tickets').insert({
          user_id: user.id,
          category: 'Nuevo evento',
          subject: `Crear/validar evento: ${newEventName.trim()}`,
          message:
            `Se creó un evento "Pendiente" desde /sell.\n` +
            `Evento: ${newEventName.trim()}\n` +
            `Fecha: ${newEventDate}\n` +
            `Lugar: ${newEventLocation.trim()}\n` +
            `User: ${sellerName} (${user.email})\n` +
            `EventId: ${finalEventId}`,
        });
      }

      if (!finalEventId) {
        throw new Error('Selecciona un evento.');
      }

      const priceValue = money(price);
      if (!priceValue) throw new Error('Precio inválido.');
      const originalPriceValue = originalPrice ? money(originalPrice) : null;

      // 2) Create ticket
      const { data: insertedTicket, error: insertTicketError } = await supabase
        .from('tickets')
        .insert({
          event_id: finalEventId,
          title: title.trim(),
          description: description.trim() || null,
          sector: sector.trim() || null,
          row: row.trim() || null,
          seat: seat.trim() || null,
          price: priceValue,
          original_price: originalPriceValue,
          seller_id: user.id,
          seller_name: sellerName,
        })
        .select('id')
        .single();

      if (insertTicketError) {
        // Si la tabla tiene nombres de columnas distintos, aquí va a reventar.
        console.error(insertTicketError);
        throw new Error('No se pudo crear la publicación.');
      }

      // 3) Upload file (optional) + avisar a soporte para validación
      let uploadedPath: string | null = null;
      if (file) {
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const path = `${user.id}/${insertedTicket.id}/${Date.now()}_${safeName}`;
        const { error: uploadError } = await supabase.storage.from('tickets').upload(path, file, {
          upsert: false,
        });
        if (!uploadError) uploadedPath = path;
      }

      await supabase.from('support_tickets').insert({
        user_id: user.id,
        category: 'Validación de entrada',
        subject: `Validar entrada: ${title.trim()}`,
        message:
          `Nueva entrada publicada desde /sell.\n` +
          `TicketId: ${insertedTicket.id}\n` +
          `EventId: ${finalEventId}\n` +
          `Vendedor: ${sellerName} (${user.email})\n` +
          `Archivo: ${uploadedPath ?? 'No adjuntó archivo'}\n` +
          `Precio: ${priceValue}`,
      });

      setSuccess('Listo 🟢 Tu entrada quedó publicada.');

      // Redirigir al evento
      router.push(`/events/${finalEventId}`);
    } catch (e: any) {
      setError(e?.message || 'Algo salió mal.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <main className="container mx-auto px-6 py-10">
        <h1 className="text-3xl font-bold mb-2">Vender entrada</h1>
        <p className="text-gray-600">Cargando...</p>
      </main>
    );
  }

  return (
    <main className="container mx-auto px-6 py-10">
      <h1 className="text-4xl font-bold mb-6">Vender entrada</h1>

      {/* Stepper */}
      <div className="w-full bg-white rounded-xl shadow-sm border p-4 mb-6">
        <div className="flex items-center justify-between text-sm text-gray-600">
          <div className={`flex items-center gap-2 ${step === 1 ? 'font-semibold text-gray-900' : ''}`}>1 <span>Detalles</span></div>
          <div className="flex-1 mx-3 h-px bg-gray-200" />
          <div className={`flex items-center gap-2 ${step === 2 ? 'font-semibold text-gray-900' : ''}`}>2 <span>Archivo</span></div>
          <div className="flex-1 mx-3 h-px bg-gray-200" />
          <div className={`flex items-center gap-2 ${step === 3 ? 'font-semibold text-gray-900' : ''}`}>3 <span>Confirmar</span></div>
        </div>
      </div>

      {(error || success) && (
        <div
          className={`rounded-xl border p-4 mb-6 ${error ? 'bg-red-50 border-red-200 text-red-800' : 'bg-green-50 border-green-200 text-green-800'}`}
        >
          {error || success}
        </div>
      )}

      {step === 1 && (
        <section className="bg-white rounded-xl shadow-sm border p-6">
          <h2 className="text-2xl font-semibold mb-4">Detalles de la entrada</h2>

          <div className="mb-4">
            <label className="flex items-start gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                className="mt-1"
                checked={eventNotListed}
                onChange={(e) => {
                  setEventNotListed(e.target.checked);
                  setEventId('');
                }}
              />
              <div>
                <div className="font-medium">Mi evento no está en el listado</div>
                <div className="text-sm text-gray-600">Puedes publicarla igual y avisamos a soporte para completar el evento.</div>
              </div>
            </label>
          </div>

          {!eventNotListed ? (
            <div className="mb-4">
              <label className="block font-medium mb-2">Evento *</label>
              <select
                value={eventId}
                onChange={(e) => setEventId(e.target.value)}
                className="w-full border rounded-lg px-4 py-3"
              >
                <option value="">Selecciona un evento...</option>
                {eventOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              {events.length === 0 && (
                <p className="text-sm text-red-600 mt-2">No hay eventos cargados. Crea uno en /admin/events.</p>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block font-medium mb-2">Nombre del evento *</label>
                <input
                  value={newEventName}
                  onChange={(e) => setNewEventName(e.target.value)}
                  className="w-full border rounded-lg px-4 py-3"
                  placeholder="Ej: Chayanne"
                />
              </div>
              <div>
                <label className="block font-medium mb-2">Fecha *</label>
                <input
                  type="date"
                  value={newEventDate}
                  onChange={(e) => setNewEventDate(e.target.value)}
                  className="w-full border rounded-lg px-4 py-3"
                />
              </div>
              <div>
                <label className="block font-medium mb-2">Lugar *</label>
                <input
                  value={newEventLocation}
                  onChange={(e) => setNewEventLocation(e.target.value)}
                  className="w-full border rounded-lg px-4 py-3"
                  placeholder="Ej: Movistar Arena, Santiago"
                />
              </div>
            </div>
          )}

          <div className="mb-4">
            <label className="block font-medium mb-2">Título de la entrada *</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full border rounded-lg px-4 py-3"
              placeholder="Ej: Entrada General - Platea Alta"
            />
          </div>

          <div className="mb-4">
            <label className="block font-medium mb-2">Descripción</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full border rounded-lg px-4 py-3 min-h-[110px]"
              placeholder="Ubicación específica, estado, restricciones, etc."
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block font-medium mb-2">Sector</label>
              <input value={sector} onChange={(e) => setSector(e.target.value)} className="w-full border rounded-lg px-4 py-3" placeholder="Cancha, Platea..." />
            </div>
            <div>
              <label className="block font-medium mb-2">Fila</label>
              <input value={row} onChange={(e) => setRow(e.target.value)} className="w-full border rounded-lg px-4 py-3" placeholder="A, B, 1..." />
            </div>
            <div>
              <label className="block font-medium mb-2">Asiento</label>
              <input value={seat} onChange={(e) => setSeat(e.target.value)} className="w-full border rounded-lg px-4 py-3" placeholder="1, 2, 3..." />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-2">
            <div>
              <label className="block font-medium mb-2">Precio de venta *</label>
              <input
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full border rounded-lg px-4 py-3"
                placeholder="Ej: 50000"
                inputMode="numeric"
              />
            </div>
            <div>
              <label className="block font-medium mb-2">Precio original (opcional)</label>
              <input
                value={originalPrice}
                onChange={(e) => setOriginalPrice(e.target.value)}
                className="w-full border rounded-lg px-4 py-3"
                placeholder="Ej: 65000"
                inputMode="numeric"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 mt-6">
            <button
              onClick={() => router.push('/events')}
              className="px-4 py-2 rounded-lg border"
            >
              Cancelar
            </button>
            <button
              onClick={onNext}
              className="px-5 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
              disabled={!canGoStep2}
            >
              Continuar
            </button>
          </div>
        </section>
      )}

      {step === 2 && (
        <section className="bg-white rounded-xl shadow-sm border p-6">
          <h2 className="text-2xl font-semibold mb-2">Archivo de la entrada</h2>
          <p className="text-gray-600 mb-4">
            Sube tu PDF / imagen. Esto nos ayuda a validar rápido (y te protege ante estafas).
          </p>

          <input
            type="file"
            accept="application/pdf,image/*"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="w-full border rounded-lg px-4 py-3"
          />

          {file && (
            <p className="text-sm text-gray-700 mt-3">
              Archivo seleccionado: <span className="font-medium">{file.name}</span>
            </p>
          )}

          <div className="flex items-center justify-between gap-3 mt-6">
            <button onClick={onBack} className="px-4 py-2 rounded-lg border">
              Volver
            </button>
            <button onClick={onNext} className="px-5 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700">
              Continuar
            </button>
          </div>
        </section>
      )}

      {step === 3 && (
        <section className="bg-white rounded-xl shadow-sm border p-6">
          <h2 className="text-2xl font-semibold mb-4">Confirmar publicación</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border rounded-lg p-4">
              <div className="text-sm text-gray-600 mb-1">Evento</div>
              <div className="font-medium">
                {eventNotListed ? newEventName : events.find((e) => e.id === eventId)?.name}
              </div>
              <div className="text-sm text-gray-600">
                {eventNotListed
                  ? `${newEventDate} · ${newEventLocation}`
                  : `${events.find((e) => e.id === eventId)?.date ? new Date(events.find((e) => e.id === eventId)!.date).toLocaleDateString('es-CL') : ''} · ${events.find((e) => e.id === eventId)?.location ?? ''}`}
              </div>
            </div>
            <div className="border rounded-lg p-4">
              <div className="text-sm text-gray-600 mb-1">Entrada</div>
              <div className="font-medium">{title}</div>
              <div className="text-sm text-gray-600">{description || '—'}</div>
            </div>
            <div className="border rounded-lg p-4">
              <div className="text-sm text-gray-600 mb-1">Ubicación</div>
              <div className="text-sm">Sector: {sector || '—'}</div>
              <div className="text-sm">Fila: {row || '—'}</div>
              <div className="text-sm">Asiento: {seat || '—'}</div>
            </div>
            <div className="border rounded-lg p-4">
              <div className="text-sm text-gray-600 mb-1">Precio</div>
              <div className="font-semibold">${money(price)?.toLocaleString('es-CL') ?? '—'}</div>
              <div className="text-sm text-gray-600">
                Original: {originalPrice ? `$${money(originalPrice)?.toLocaleString('es-CL') ?? '—'}` : '—'}
              </div>
              <div className="text-sm text-gray-600">Archivo: {file ? file.name : 'No adjuntó'}</div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 mt-6">
            <button onClick={onBack} className="px-4 py-2 rounded-lg border" disabled={submitting}>
              Volver
            </button>
            <button
              onClick={handleSubmit}
              className="px-5 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-60"
              disabled={submitting || !canSubmit}
            >
              {submitting ? 'Publicando…' : 'Publicar entrada'}
            </button>
          </div>
        </section>
      )}
    </main>
  );
}
