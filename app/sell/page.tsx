"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabaseClient";

type EventRow = {
  id: string;
  title: string;
  date: string; // datetime-local string o ISO desde supabase
  location: string;
  category?: string | null;
  image_url?: string | null;
};

function formatEventDate(value?: string) {
  if (!value) return "";
  // Soporta ISO o "YYYY-MM-DDTHH:mm"
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("es-CL", {
    year: "numeric",
    month: "long",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function SellPage() {
  const router = useRouter();

  const [userId, setUserId] = useState<string | null>(null);

  const [events, setEvents] = useState<EventRow[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [eventsError, setEventsError] = useState<string | null>(null);

  const [isManualEvent, setIsManualEvent] = useState(false);

  const [selectedEventId, setSelectedEventId] = useState("");
  const selectedEvent = useMemo(
    () => events.find((e) => e.id === selectedEventId) || null,
    [events, selectedEventId]
  );

  const [manualEventTitle, setManualEventTitle] = useState("");
  const [manualEventDate, setManualEventDate] = useState("");
  const [manualEventLocation, setManualEventLocation] = useState("");

  const [ticketTitle, setTicketTitle] = useState("");
  const [ticketDescription, setTicketDescription] = useState("");
  const [ticketPrice, setTicketPrice] = useState("");

  // PDF
  const [ticketPdf, setTicketPdf] = useState<File | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getUser();
      const u = data?.user;

      if (!u) {
        router.replace("/login");
        return;
      }

      setUserId(u.id);
      await loadEvents();
    };

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadEvents = async () => {
    setEventsLoading(true);
    setEventsError(null);

    const { data, error } = await supabase
      .from("events")
      .select("id, title, date, location, category, image_url")
      .order("date", { ascending: true });

    if (error) {
      setEvents([]);
      setEventsError(error.message);
      setEventsLoading(false);
      return;
    }

    setEvents((data as EventRow[]) || []);
    setEventsLoading(false);
  };

  const handlePdfChange = (file: File | null) => {
    setPdfError(null);
    setTicketPdf(null);

    if (!file) return;

    const isPdfByMime = file.type === "application/pdf";
    const isPdfByName = file.name.toLowerCase().endsWith(".pdf");

    if (!isPdfByMime && !isPdfByName) {
      setPdfError("El archivo debe ser un PDF (.pdf).");
      return;
    }

    setTicketPdf(file);
  };

  const handlePublish = async () => {
    if (!userId) return;

    // Validación base
    if (!ticketTitle.trim()) return alert("Falta el título de la entrada.");
    if (!ticketPrice.trim()) return alert("Falta el precio.");

    const priceNumber = Number(ticketPrice);
    if (Number.isNaN(priceNumber) || priceNumber <= 0) {
      return alert("El precio debe ser un número válido mayor a 0.");
    }

    // Evento seleccionado / manual
    if (!isManualEvent && !selectedEventId) {
      return alert("Selecciona un evento.");
    }
    if (isManualEvent) {
      if (!manualEventTitle.trim()) return alert("Falta el nombre del evento.");
      if (!manualEventDate.trim()) return alert("Falta la fecha del evento.");
      if (!manualEventLocation.trim()) return alert("Falta la ubicación del evento.");
    }

    // PDF requerido (si quieres que sea opcional, comenta este bloque)
    if (!ticketPdf) {
      return alert("Sube tu ticket en PDF para validar la entrada.");
    }
    if (pdfError) {
      return alert(pdfError);
    }

    // Insert (sin cambiar tu esquema actual)
    // OJO: acá solo validamos PDF. Si después quieres subirlo a Storage y guardar URL,
    // lo hacemos en el siguiente paso.
    const payload: any = {
      title: ticketTitle,
      description: ticketDescription || null,
      price: priceNumber,
      user_id: userId,
    };

    if (!isManualEvent) {
      payload.event_id = selectedEventId;
    } else {
      payload.event_title = manualEventTitle;
      payload.event_date = manualEventDate;
      payload.event_location = manualEventLocation;
    }

    const { error } = await supabase.from("tickets").insert([payload]);

    if (error) {
      console.error(error);
      return alert(`Error al publicar la entrada: ${error.message}`);
    }

    alert("Entrada publicada ✅");
    router.push("/events");
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <h1 className="text-4xl font-bold mb-8">Vender entrada</h1>

      {/* Card principal */}
      <div className="bg-white rounded-2xl shadow p-6">
        <h2 className="text-2xl font-bold mb-6">Detalles de la entrada</h2>

        {/* Toggle evento manual */}
        <label className="flex items-start gap-3 mb-6">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4"
            checked={isManualEvent}
            onChange={(e) => setIsManualEvent(e.target.checked)}
          />
          <div>
            <p className="font-medium">Mi evento no está en el listado</p>
            <p className="text-sm text-gray-600">
              Puedes publicarla igual y avisamos a soporte para completar el evento.
            </p>
          </div>
        </label>

        {/* Selector evento */}
        {!isManualEvent && (
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Evento <span className="text-red-500">*</span>
            </label>

            <select
              className="w-full border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={selectedEventId}
              onChange={(e) => setSelectedEventId(e.target.value)}
              disabled={eventsLoading}
            >
              <option value="">
                {eventsLoading ? "Cargando eventos..." : "Selecciona un evento..."}
              </option>
              {events.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.title} • {formatEventDate(ev.date)} • {ev.location}
                </option>
              ))}
            </select>

            {eventsError && (
              <p className="mt-2 text-sm text-red-600">
                No pude cargar los eventos: {eventsError}
              </p>
            )}

            {!eventsLoading && !eventsError && events.length === 0 && (
              <p className="mt-2 text-sm text-red-600">
                No hay eventos cargados. Crea uno en <span className="font-semibold">/admin/events</span>.
              </p>
            )}

            {selectedEvent && (
              <div className="mt-3 text-sm text-gray-600">
                <span className="font-medium">Seleccionado:</span> {selectedEvent.title} —{" "}
                {formatEventDate(selectedEvent.date)} — {selectedEvent.location}
              </div>
            )}
          </div>
        )}

        {/* Evento manual */}
        {isManualEvent && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nombre del evento <span className="text-red-500">*</span>
              </label>
              <input
                className="w-full border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={manualEventTitle}
                onChange={(e) => setManualEventTitle(e.target.value)}
                placeholder="Ej: Chayanne"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Fecha y hora <span className="text-red-500">*</span>
              </label>
              <input
                type="datetime-local"
                className="w-full border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={manualEventDate}
                onChange={(e) => setManualEventDate(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Ubicación <span className="text-red-500">*</span>
              </label>
              <input
                className="w-full border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={manualEventLocation}
                onChange={(e) => setManualEventLocation(e.target.value)}
                placeholder="Ej: Movistar Arena — Santiago"
              />
            </div>
          </div>
        )}

        {/* Datos entrada */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Título de la entrada <span className="text-red-500">*</span>
            </label>
            <input
              className="w-full border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={ticketTitle}
              onChange={(e) => setTicketTitle(e.target.value)}
              placeholder="Ej: Entrada General - Platea Alta"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Precio <span className="text-red-500">*</span>
            </label>
            <input
              className="w-full border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={ticketPrice}
              onChange={(e) => setTicketPrice(e.target.value)}
              placeholder="Ej: 45000"
              inputMode="numeric"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Descripción
            </label>
            <textarea
              className="w-full border rounded-xl px-4 py-3 min-h-[120px] focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={ticketDescription}
              onChange={(e) => setTicketDescription(e.target.value)}
              placeholder="Ubicación específica, estado, restricciones, etc."
            />
          </div>

          {/* PDF upload (mínimo cambio, sin tocar tu base) */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Ticket (PDF) <span className="text-red-500">*</span>
            </label>
            <input
              type="file"
              accept="application/pdf,.pdf"
              className="w-full border rounded-xl px-4 py-3 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              onChange={(e) => handlePdfChange(e.target.files?.[0] || null)}
            />
            {ticketPdf && !pdfError && (
              <p className="mt-2 text-sm text-gray-600">Archivo: {ticketPdf.name}</p>
            )}
            {pdfError && <p className="mt-2 text-sm text-red-600">{pdfError}</p>}
          </div>
        </div>

        <div className="mt-8 flex items-center gap-3">
          <button
            onClick={handlePublish}
            className="px-6 py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700"
          >
            Publicar entrada
          </button>

          <button
            onClick={() => router.push("/events")}
            className="px-6 py-3 rounded-xl border font-semibold hover:bg-gray-50"
          >
            Ver eventos
          </button>
        </div>
      </div>
    </div>
  );
}
