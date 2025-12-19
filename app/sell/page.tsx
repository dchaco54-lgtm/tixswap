'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

type EventRow = {
  id: string;
  title: string;
  date: string | null;
  location: string | null;
  category?: string | null;
  image_url?: string | null;
};

type Step = 1 | 2 | 3;

export default function SellPage() {
  const router = useRouter();

  const [step, setStep] = useState<Step>(1);

  const [userId, setUserId] = useState<string | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);

  const [events, setEvents] = useState<EventRow[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [eventsError, setEventsError] = useState<string | null>(null);

  const [eventNotInList, setEventNotInList] = useState(false);

  // Caso 1: evento existente
  const [eventId, setEventId] = useState('');

  // Caso 2: evento no existente (solicitud a soporte)
  const [customEventName, setCustomEventName] = useState('');
  const [customEventDate, setCustomEventDate] = useState('');
  const [customEventLocation, setCustomEventLocation] = useState('');

  // Datos entrada
  const [ticketTitle, setTicketTitle] = useState('');
  const [description, setDescription] = useState('');
  const [sector, setSector] = useState('');
  const [row, setRow] = useState('');
  const [seat, setSeat] = useState('');

  const [price, setPrice] = useState<number | ''>('');
  const [originalPrice, setOriginalPrice] = useState<number | ''>('');
  const [saleType, setSaleType] = useState<'fixed' | 'auction'>('fixed');

  // Archivo
  const [file, setFile] = useState<File | null>(null);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const selectedEvent = useMemo(
    () => events.find((e) => e.id === eventId) || null,
    [events, eventId]
  );

  useEffect(() => {
    (async () => {
      setLoadingUser(true);
      const { data, error } = await supabase.auth.getUser();
      if (error) {
        console.error('[sell] getUser error', error);
      }
      const u = data?.user ?? null;

      if (!u) {
        router.replace('/login?redirect=/sell');
        return;
      }

      setUserId(u.id);
      setLoadingUser(false);
    })();
  }, [router]);

  const fetchEvents = async () => {
    setEventsLoading(true);
    setEventsError(null);
    try {
      const { data, error } = await supabase
        .from('events')
        .select('id,title,date,location,category,image_url')
        .order('date', { ascending: true });

      if (error) throw error;

      setEvents((data as EventRow[]) || []);
    } catch (e: any) {
      console.error('[sell] fetchEvents error:', e);
      setEvents([]);
      setEventsError(e?.message || 'No pude cargar los eventos. Intenta de nuevo.');
    } finally {
      setEventsLoading(false);
    }
  };

  useEffect(() => {
    if (!loadingUser) fetchEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingUser]);

  const canGoNextFromStep1 = useMemo(() => {
    if (eventNotInList) {
      return (
        customEventName.trim().length >= 3 &&
        customEventDate.trim().length >= 6 &&
        customEventLocation.trim().length >= 3 &&
        ticketTitle.trim().length >= 3 &&
        price !== '' &&
        Number(price) > 0
      );
    }
    return eventId && ticketTitle.trim().length >= 3 && price !== '' && Number(price) > 0;
  }, [
    eventNotInList,
    customEventName,
    customEventDate,
    customEventLocation,
    eventId,
    ticketTitle,
    price,
  ]);

  const goToStep = (n: Step) => {
    setSaveError(null);
    setStep(n);
  };

  const uploadTicketFile = async (ownerId: string) => {
    if (!file) return null;

    // Bucket recomendado: "tickets" (o el que estés usando)
    const ext = file.name.split('.').pop() || 'file';
    const safeExt = ext.toLowerCase();
    const path = `${ownerId}/${crypto.randomUUID()}.${safeExt}`;

    const { error } = await supabase.storage.from('tickets').upload(path, file, {
      upsert: false,
      cacheControl: '3600',
    });

    if (error) throw error;
    return path;
  };

  const createSupportTicketIfNeeded = async (ticketId: string) => {
    if (!eventNotInList) return;

    const payload = {
      type: 'missing_event',
      status: 'open',
      ticket_id: ticketId,
      requested_event_name: customEventName.trim(),
      requested_event_date: customEventDate.trim(),
      requested_event_location: customEventLocation.trim(),
      message: `Usuario publicó entrada con evento no listado. Crear evento y asociar entrada ${ticketId}.`,
    };

    const { error } = await supabase.from('support_tickets').insert(payload);
    if (error) throw error;

    // Si después conectas correo, aquí disparas un endpoint /api/notify-support
  };

  const handlePublish = async () => {
    if (!userId) return;
    setSaving(true);
    setSaveError(null);

    try {
      const filePath = await uploadTicketFile(userId);

      // Si no está en listado, lo dejamos sin event_id por ahora (null)
      const finalEventId = eventNotInList ? null : eventId;

      const insertPayload: any = {
        event_id: finalEventId,
        title: ticketTitle.trim(),
        description: description.trim() || null,
        sector: sector.trim() || null,
        row: row.trim() || null,
        seat: seat.trim() || null,
        price: Number(price),
        original_price: originalPrice === '' ? null : Number(originalPrice),
        sale_type: saleType,
        owner_id: userId,
        status: 'published',
        file_path: filePath,
      };

      // Datos extra para soporte si evento no existe
      if (eventNotInList) {
        insertPayload.requested_event_name = customEventName.trim();
        insertPayload.requested_event_date = customEventDate.trim();
        insertPayload.requested_event_location = customEventLocation.trim();
      }

      const { data, error } = await supabase
        .from('tickets')
        .insert(insertPayload)
        .select('id')
        .single();

      if (error) throw error;

      const ticketId = data?.id as string;
      await createSupportTicketIfNeeded(ticketId);

      // Redirección: si el evento existe, al detalle del evento; si no, a /events con aviso
      if (!eventNotInList && finalEventId) {
        router.push(`/events/${finalEventId}`);
      } else {
        router.push(`/events?notice=published_without_event`);
      }
    } catch (e: any) {
      console.error('[sell] publish error:', e);
      setSaveError(e?.message || 'No se pudo crear la publicación.');
    } finally {
      setSaving(false);
    }
  };

  if (loadingUser) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-10">
        <h1 className="text-3xl font-bold">Vender entrada</h1>
        <p className="mt-6 text-gray-600">Cargando…</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <h1 className="text-4xl font-bold">Vender entrada</h1>

      {/* Stepper */}
      <div className="mt-8 border rounded-xl overflow-hidden">
        <div className="grid grid-cols-3 text-sm">
          <div className={`px-6 py-4 ${step === 1 ? 'font-semibold' : 'text-gray-600'}`}>
            1&nbsp;&nbsp;Detalles
          </div>
          <div className={`px-6 py-4 text-center ${step === 2 ? 'font-semibold' : 'text-gray-600'}`}>
            2&nbsp;&nbsp;Archivo
          </div>
          <div className={`px-6 py-4 text-right ${step === 3 ? 'font-semibold' : 'text-gray-600'}`}>
            3&nbsp;&nbsp;Confirmar
          </div>
        </div>
      </div>

      {/* Eventos error */}
      {eventsError && (
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-5 py-4">
          <div className="font-medium text-red-800">{eventsError}</div>
          <button
            onClick={fetchEvents}
            className="mt-3 inline-flex items-center rounded-lg border px-3 py-2 text-sm font-medium hover:bg-white"
          >
            Reintentar
          </button>
        </div>
      )}

      {/* Step 1 */}
      {step === 1 && (
        <div className="mt-8 border rounded-2xl p-8">
          <h2 className="text-2xl font-bold">Detalles de la entrada</h2>

          <label className="mt-6 flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              checked={eventNotInList}
              onChange={(e) => {
                setEventNotInList(e.target.checked);
                setEventId('');
              }}
              className="mt-1"
            />
            <div>
              <div className="font-medium">Mi evento no está en el listado</div>
              <div className="text-gray-600">
                Puedes publicarla igual y avisamos a soporte para completar el evento.
              </div>
            </div>
          </label>

          {/* Evento */}
          {!eventNotInList ? (
            <div className="mt-6">
              <label className="block text-sm font-medium">Evento *</label>
              <select
                value={eventId}
                onChange={(e) => setEventId(e.target.value)}
                className="mt-2 w-full rounded-xl border px-4 py-3"
                disabled={eventsLoading}
              >
                <option value="">{eventsLoading ? 'Cargando eventos…' : 'Selecciona un evento…'}</option>
                {events.map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    {ev.title}
                    {ev.date ? ` — ${new Date(ev.date).toLocaleDateString('es-CL')}` : ''}
                    {ev.location ? ` — ${ev.location}` : ''}
                  </option>
                ))}
              </select>

              {!eventsLoading && events.length === 0 && (
                <div className="mt-2 text-sm text-red-600">
                  No hay eventos cargados. Crea uno en <span className="font-medium">/admin/events</span>.
                </div>
              )}
            </div>
          ) : (
            <div className="mt-6 grid gap-4">
              <div>
                <label className="block text-sm font-medium">Nombre del evento *</label>
                <input
                  value={customEventName}
                  onChange={(e) => setCustomEventName(e.target.value)}
                  className="mt-2 w-full rounded-xl border px-4 py-3"
                  placeholder="Ej: Chayanne - Tour 2026"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-1">
                  <label className="block text-sm font-medium">Fecha *</label>
                  <input
                    value={customEventDate}
                    onChange={(e) => setCustomEventDate(e.target.value)}
                    className="mt-2 w-full rounded-xl border px-4 py-3"
                    placeholder="dd/mm/aaaa"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium">Lugar *</label>
                  <input
                    value={customEventLocation}
                    onChange={(e) => setCustomEventLocation(e.target.value)}
                    className="mt-2 w-full rounded-xl border px-4 py-3"
                    placeholder="Ej: Movistar Arena, Santiago"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Título */}
          <div className="mt-8">
            <label className="block text-sm font-medium">Título de la entrada *</label>
            <input
              value={ticketTitle}
              onChange={(e) => setTicketTitle(e.target.value)}
              className="mt-2 w-full rounded-xl border px-4 py-3"
              placeholder="Ej: Entrada General - Platea Alta"
            />
          </div>

          {/* Descripción */}
          <div className="mt-6">
            <label className="block text-sm font-medium">Descripción</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-2 w-full rounded-xl border px-4 py-3 min-h-[110px]"
              placeholder="Ubicación específica, estado, restricciones, etc."
            />
          </div>

          {/* Sector / Fila / Asiento */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium">Sector</label>
              <input
                value={sector}
                onChange={(e) => setSector(e.target.value)}
                className="mt-2 w-full rounded-xl border px-4 py-3"
                placeholder="Cancha, Platea, etc."
              />
            </div>
            <div>
              <label className="block text-sm font-medium">Fila</label>
              <input
                value={row}
                onChange={(e) => setRow(e.target.value)}
                className="mt-2 w-full rounded-xl border px-4 py-3"
                placeholder="A, B, 1, 2..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium">Asiento</label>
              <input
                value={seat}
                onChange={(e) => setSeat(e.target.value)}
                className="mt-2 w-full rounded-xl border px-4 py-3"
                placeholder="1, 2, 3..."
              />
            </div>
          </div>

          {/* Precios */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium">Precio de venta *</label>
              <input
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value === '' ? '' : Number(e.target.value))}
                className="mt-2 w-full rounded-xl border px-4 py-3"
                placeholder="50000"
                min={0}
              />
            </div>
            <div>
              <label className="block text-sm font-medium">Precio original (opcional)</label>
              <input
                type="number"
                value={originalPrice}
                onChange={(e) => setOriginalPrice(e.target.value === '' ? '' : Number(e.target.value))}
                className="mt-2 w-full rounded-xl border px-4 py-3"
                placeholder="65000"
                min={0}
              />
            </div>
          </div>

          {/* Tipo de venta */}
          <div className="mt-6">
            <label className="block text-sm font-medium">Tipo de venta</label>
            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setSaleType('fixed')}
                className={`text-left rounded-xl border p-4 hover:bg-gray-50 ${
                  saleType === 'fixed' ? 'border-blue-500 ring-2 ring-blue-100' : ''
                }`}
              >
                <div className="font-semibold">Precio fijo</div>
                <div className="text-sm text-gray-600">Vende inmediatamente al precio que estableces.</div>
              </button>

              <button
                type="button"
                onClick={() => setSaleType('auction')}
                className={`text-left rounded-xl border p-4 hover:bg-gray-50 ${
                  saleType === 'auction' ? 'border-blue-500 ring-2 ring-blue-100' : ''
                }`}
              >
                <div className="font-semibold">Subasta (próximamente)</div>
                <div className="text-sm text-gray-600">Los compradores podrán pujar por tu entrada.</div>
              </button>
            </div>
          </div>

          <div className="mt-8 flex items-center justify-between">
            <button
              onClick={() => router.push('/')}
              className="rounded-xl border px-5 py-3 font-medium hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              disabled={!canGoNextFromStep1}
              onClick={() => goToStep(2)}
              className="rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white disabled:opacity-50"
            >
              Continuar
            </button>
          </div>
        </div>
      )}

      {/* Step 2 */}
      {step === 2 && (
        <div className="mt-8 border rounded-2xl p-8">
          <h2 className="text-2xl font-bold">Archivo</h2>
          <p className="mt-2 text-gray-600">
            Sube una foto o PDF de tu entrada para validación. (Mientras más claro, más rápido aprobamos)
          </p>

          <div className="mt-6">
            <input
              type="file"
              accept="image/*,application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="w-full rounded-xl border px-4 py-3"
            />
            {file && (
              <div className="mt-2 text-sm text-gray-700">
                Archivo seleccionado: <span className="font-medium">{file.name}</span>
              </div>
            )}
          </div>

          <div className="mt-8 flex items-center justify-between">
            <button
              onClick={() => goToStep(1)}
              className="rounded-xl border px-5 py-3 font-medium hover:bg-gray-50"
            >
              Volver
            </button>
            <button
              onClick={() => goToStep(3)}
              className="rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white"
            >
              Confirmar
            </button>
          </div>
        </div>
      )}

      {/* Step 3 */}
      {step === 3 && (
        <div className="mt-8 border rounded-2xl p-8">
          <h2 className="text-2xl font-bold">Confirmar</h2>

          {saveError && (
            <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-red-800">
              {saveError}
            </div>
          )}

          <div className="mt-6 grid gap-3 text-sm">
            <div>
              <span className="text-gray-600">Evento:</span>{' '}
              {!eventNotInList
                ? selectedEvent?.title || '—'
                : `${customEventName} (${customEventDate}) — ${customEventLocation}`}
            </div>
            <div>
              <span className="text-gray-600">Entrada:</span> {ticketTitle || '—'}
            </div>
            <div>
              <span className="text-gray-600">Precio:</span> {price === '' ? '—' : `$${Number(price).toLocaleString('es-CL')}`}
            </div>
            <div>
              <span className="text-gray-600">Archivo:</span> {file ? file.name : 'No adjuntado'}
            </div>
          </div>

          <div className="mt-8 flex items-center justify-between">
            <button
              onClick={() => goToStep(2)}
              className="rounded-xl border px-5 py-3 font-medium hover:bg-gray-50"
            >
              Volver
            </button>

            <button
              disabled={saving}
              onClick={handlePublish}
              className="rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white disabled:opacity-60"
            >
              {saving ? 'Publicando…' : 'Publicar entrada'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

