"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabaseClient";

type EventRow = {
  id: string;
  title: string;
  starts_at: string | null;
  venue: string | null;
  city: string | null;
};

function formatEventDate(iso?: string | null) {
  if (!iso) return "Fecha por confirmar";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Fecha por confirmar";
  return d.toLocaleDateString("es-CL", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatCLP(value: string) {
  const n = Number(value);
  if (Number.isNaN(n)) return value;
  return n.toLocaleString("es-CL");
}

function classNames(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(" ");
}

export default function SellPage() {
  const router = useRouter();

  // Stepper: 1 Detalles, 2 Archivo, 3 Confirmar
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Usuario
  const [userId, setUserId] = useState<string>("");

  // Eventos
  const [events, setEvents] = useState<EventRow[]>([]);
  const [eventsLoading, setEventsLoading] = useState<boolean>(true);
  const [eventsError, setEventsError] = useState<string>("");

  // UI: buscar evento (filtrar)
  const [eventQuery, setEventQuery] = useState<string>("");

  // Selección evento
  const [isManualEvent, setIsManualEvent] = useState<boolean>(false);
  const [selectedEventId, setSelectedEventId] = useState<string>("");

  // Evento manual (si no está en listado)
  const [manualEventTitle, setManualEventTitle] = useState<string>("");
  const [manualEventDate, setManualEventDate] = useState<string>("");
  const [manualEventLocation, setManualEventLocation] = useState<string>("");

  // Detalles ticket (UI)
  const [ticketTitle, setTicketTitle] = useState<string>("");
  const [ticketDescription, setTicketDescription] = useState<string>("");

  const [sector, setSector] = useState<string>("");
  const [row, setRow] = useState<string>("");
  const [seat, setSeat] = useState<string>("");

  const [ticketPrice, setTicketPrice] = useState<string>("");
  const [originalPrice, setOriginalPrice] = useState<string>("");

  // Tipo de venta (UI)
  const [saleType, setSaleType] = useState<"fixed" | "auction">("fixed");
  const [emergencyAuction, setEmergencyAuction] = useState<boolean>(false); // por ahora “futuro”

  // PDF
  const [ticketPdf, setTicketPdf] = useState<File | null>(null);
  const [pdfError, setPdfError] = useState<string>("");

  // ======================
  // Init: user + events
  // ======================
  useEffect(() => {
    const init = async () => {
      // user
      const { data: authData } = await supabase.auth.getSession();
      const uid = authData?.session?.user?.id || "";
      setUserId(uid);

      // events
      setEventsLoading(true);
      setEventsError("");
      try {
        const { data, error } = await supabase
          .from("events")
          .select("id,title,starts_at,venue,city")
          .order("starts_at", { ascending: true });

        if (error) throw error;
        setEvents((data as EventRow[]) || []);
      } catch (e: any) {
        console.error(e);
        setEventsError(e?.message || "No pude cargar los eventos.");
      } finally {
        setEventsLoading(false);
      }
    };

    init();
  }, []);

  const filteredEvents = useMemo(() => {
    const q = eventQuery.trim().toLowerCase();
    if (!q) return events;

    return events.filter((ev) => {
      const where = [
        ev.title,
        ev.venue || "",
        ev.city || "",
        formatEventDate(ev.starts_at),
      ]
        .join(" ")
        .toLowerCase();
      return where.includes(q);
    });
  }, [events, eventQuery]);

  const selectedEvent = useMemo(() => {
    return events.find((e) => e.id === selectedEventId) || null;
  }, [events, selectedEventId]);

  // ======================
  // PDF validation
  // ======================
  const handlePdfChange = (file: File | null) => {
    setTicketPdf(null);
    setPdfError("");

    if (!file) return;

    const isPdf =
      file.type === "application/pdf" ||
      file.name.toLowerCase().endsWith(".pdf");

    if (!isPdf) {
      setPdfError("El archivo debe ser PDF.");
      return;
    }

    // límite suave (ajústalo si quieres)
    const maxMB = 10;
    const sizeMB = file.size / (1024 * 1024);
    if (sizeMB > maxMB) {
      setPdfError(`El PDF no puede superar ${maxMB}MB.`);
      return;
    }

    setTicketPdf(file);
  };

  // ======================
  // Validations (por step)
  // ======================
  const validateStep1 = () => {
    if (!ticketTitle.trim()) return "Falta el título de la entrada.";
    const priceNumber = Number(ticketPrice);
    if (Number.isNaN(priceNumber) || priceNumber <= 0)
      return "El precio debe ser un número válido mayor a 0.";

    if (!isManualEvent && !selectedEventId) return "Selecciona un evento.";

    if (isManualEvent) {
      if (!manualEventTitle.trim()) return "Falta el nombre del evento.";
      if (!manualEventDate.trim()) return "Falta la fecha del evento.";
      if (!manualEventLocation.trim()) return "Falta la ubicación del evento.";
    }

    return "";
  };

  const validateStep2 = () => {
    if (!ticketPdf) return "Sube tu ticket en PDF para validar la entrada.";
    if (pdfError) return pdfError;
    return "";
  };

  // ======================
  // Publish (mantengo base)
  // ======================
  const handlePublish = async () => {
    // Validación final
    const e1 = validateStep1();
    if (e1) return alert(e1);
    const e2 = validateStep2();
    if (e2) return alert(e2);

    if (!userId) {
      return alert("No estás logueado. Inicia sesión para publicar.");
    }

    const priceNumber = Number(ticketPrice);

    // Mantengo tu esquema actual (no “rompo” DB):
    // - Inserta en tickets: title, description, price, user_id
    // - + event_id OR event_title/event_date/event_location
    // (Los campos extra de UI por ahora son solo UI, los conectamos después)
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

  // ======================
  // UI helpers
  // ======================
  const steps = [
    { id: 1, label: "Detalles" },
    { id: 2, label: "Archivo" },
    { id: 3, label: "Confirmar" },
  ] as const;

  const Stepper = () => {
    return (
      <div className="w-full">
        <div className="flex items-center justify-between gap-4">
          {steps.map((s, idx) => {
            const active = step === s.id;
            const done = step > s.id;

            return (
              <div key={s.id} className="flex items-center flex-1">
                <div className="flex items-center gap-3">
                  <div
                    className={classNames(
                      "h-10 w-10 rounded-full flex items-center justify-center font-bold",
                      active && "bg-white text-indigo-700",
                      done && "bg-white/90 text-indigo-700",
                      !active && !done && "bg-white/25 text-white"
                    )}
                  >
                    {s.id}
                  </div>
                  <div
                    className={classNames(
                      "font-semibold",
                      active || done ? "text-white" : "text-white/80"
                    )}
                  >
                    {s.label}
                  </div>
                </div>

                {/* line */}
                {idx < steps.length - 1 && (
                  <div className="mx-4 h-[2px] flex-1 rounded bg-white/35" />
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const SectionTitle = ({
    title,
    subtitle,
  }: {
    title: string;
    subtitle?: string;
  }) => (
    <div className="mb-5">
      <h2 className="text-xl font-bold text-gray-900">{title}</h2>
      {subtitle && <p className="text-sm text-gray-600 mt-1">{subtitle}</p>}
    </div>
  );

  const Label = ({ children }: { children: React.ReactNode }) => (
    <label className="block text-sm font-medium text-gray-700 mb-2">
      {children}
    </label>
  );

  const Input = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input
      {...props}
      className={classNames(
        "w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900 placeholder:text-gray-400",
        "focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500",
        props.className
      )}
    />
  );

  const Textarea = (
    props: React.TextareaHTMLAttributes<HTMLTextAreaElement>
  ) => (
    <textarea
      {...props}
      className={classNames(
        "w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900 placeholder:text-gray-400",
        "focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500",
        props.className
      )}
    />
  );

  // ======================
  // Render
  // ======================
  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      {/* Card grande (como el mock) */}
      <div className="rounded-3xl overflow-hidden border border-gray-200 bg-white shadow-sm">
        {/* Header degradado */}
        <div className="bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-600 px-8 py-8">
          <h1 className="text-3xl md:text-4xl font-extrabold text-white">
            Vender entrada
          </h1>
          <p className="text-white/85 mt-2">
            Publica tu entrada con respaldo. Elige evento, completa detalles y
            sube tu PDF.
          </p>

          <div className="mt-6">
            <Stepper />
          </div>
        </div>

        {/* Body */}
        <div className="px-6 md:px-8 py-8">
          {/* Error de eventos */}
          {eventsError && (
            <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">
              No pude cargar los eventos: {eventsError}
            </div>
          )}

          {/* STEP 1 */}
          {step === 1 && (
            <div className="space-y-8">
              <div className="rounded-2xl border border-gray-200 bg-white p-6 md:p-7">
                <SectionTitle
                  title="Detalles de la entrada"
                  subtitle="Completa lo esencial para que la gente la entienda altiro."
                />

                {/* Evento manual toggle */}
                <label className="flex items-start gap-3 mb-6">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4"
                    checked={isManualEvent}
                    onChange={(e) => setIsManualEvent(e.target.checked)}
                  />
                  <div>
                    <p className="font-semibold text-gray-900">
                      Mi evento no está en el listado
                    </p>
                    <p className="text-sm text-gray-600">
                      Puedes dejar la solicitud y Soporte lo crea para completar
                      el evento.
                    </p>
                  </div>
                </label>

                {/* Evento existente */}
                {!isManualEvent && (
                  <div className="space-y-3 mb-6">
                    <Label>
                      Evento <span className="text-red-500">*</span>
                    </Label>

                    {/* Input búsqueda */}
                    <Input
                      placeholder="Escribe para buscar (ej: Chayanne, Doja Cat...)"
                      value={eventQuery}
                      onChange={(e) => setEventQuery(e.target.value)}
                    />

                    {/* Select filtrado */}
                    <select
                      className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      value={selectedEventId}
                      onChange={(e) => setSelectedEventId(e.target.value)}
                      disabled={eventsLoading}
                    >
                      <option value="">
                        {eventsLoading
                          ? "Cargando eventos..."
                          : "Selecciona un evento"}
                      </option>
                      {filteredEvents.map((ev) => {
                        const where = ev.venue || ev.city || "Chile";
                        return (
                          <option key={ev.id} value={ev.id}>
                            {ev.title} • {formatEventDate(ev.starts_at)} •{" "}
                            {where}
                          </option>
                        );
                      })}
                    </select>

                    {!eventsLoading && events.length === 0 && (
                      <p className="text-sm text-red-600">
                        No hay eventos cargados. Revisa tu importador / admin.
                      </p>
                    )}
                  </div>
                )}

                {/* Evento manual fields */}
                {isManualEvent && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div className="md:col-span-2">
                      <Label>
                        Nombre del evento <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        placeholder="Ej: My Chemical Romance"
                        value={manualEventTitle}
                        onChange={(e) => setManualEventTitle(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>
                        Fecha <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        placeholder="Ej: 29/01/2026"
                        value={manualEventDate}
                        onChange={(e) => setManualEventDate(e.target.value)}
                      />
                    </div>
                    <div className="md:col-span-3">
                      <Label>
                        Ubicación <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        placeholder="Ej: Movistar Arena, Santiago"
                        value={manualEventLocation}
                        onChange={(e) => setManualEventLocation(e.target.value)}
                      />
                    </div>
                  </div>
                )}

                {/* Título + descripción */}
                <div className="grid grid-cols-1 gap-5">
                  <div>
                    <Label>
                      Título de la entrada <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      placeholder="Ej: Entrada General - Platea Alta"
                      value={ticketTitle}
                      onChange={(e) => setTicketTitle(e.target.value)}
                    />
                  </div>

                  <div>
                    <Label>Descripción</Label>
                    <Textarea
                      rows={4}
                      placeholder="Describe tu entrada (ubicación específica, estado, restricciones, etc.)"
                      value={ticketDescription}
                      onChange={(e) => setTicketDescription(e.target.value)}
                    />
                  </div>
                </div>

                {/* Sector/Fila/Asiento */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                  <div>
                    <Label>Sector</Label>
                    <Input
                      placeholder="Campo, Platea, etc."
                      value={sector}
                      onChange={(e) => setSector(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Fila</Label>
                    <Input
                      placeholder="A, B, 1, 2, etc."
                      value={row}
                      onChange={(e) => setRow(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Asiento</Label>
                    <Input
                      placeholder="1, 2, 3, etc."
                      value={seat}
                      onChange={(e) => setSeat(e.target.value)}
                    />
                  </div>
                </div>

                {/* Precios */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                  <div>
                    <Label>
                      Precio de venta <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      inputMode="numeric"
                      placeholder="50000"
                      value={ticketPrice}
                      onChange={(e) => setTicketPrice(e.target.value)}
                    />
                    {ticketPrice && (
                      <p className="text-xs text-gray-500 mt-2">
                        CLP ${formatCLP(ticketPrice)}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label>Precio original (opcional)</Label>
                    <Input
                      inputMode="numeric"
                      placeholder="60000"
                      value={originalPrice}
                      onChange={(e) => setOriginalPrice(e.target.value)}
                    />
                    {originalPrice && (
                      <p className="text-xs text-gray-500 mt-2">
                        CLP ${formatCLP(originalPrice)}
                      </p>
                    )}
                  </div>
                </div>

                {/* Tipo de venta cards */}
                <div className="mt-7">
                  <Label>Tipo de venta</Label>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Precio fijo */}
                    <button
                      type="button"
                      onClick={() => setSaleType("fixed")}
                      className={classNames(
                        "text-left rounded-2xl border p-5 transition",
                        saleType === "fixed"
                          ? "border-indigo-500 bg-indigo-50"
                          : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={classNames(
                            "h-10 w-10 rounded-xl flex items-center justify-center",
                            saleType === "fixed"
                              ? "bg-indigo-600 text-white"
                              : "bg-gray-100 text-gray-700"
                          )}
                        >
                          $
                        </div>
                        <div className="flex-1">
                          <div className="font-bold text-gray-900">
                            Precio fijo
                          </div>
                          <div className="text-sm text-gray-600 mt-1">
                            Vende inmediatamente al precio que estableciste.
                          </div>
                        </div>
                      </div>
                    </button>

                    {/* Subasta (futuro) */}
                    <button
                      type="button"
                      onClick={() => {
                        // por ahora, no lo activamos “real”
                        setSaleType("auction");
                      }}
                      className={classNames(
                        "text-left rounded-2xl border p-5 transition relative",
                        saleType === "auction"
                          ? "border-orange-500 bg-orange-50"
                          : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                      )}
                    >
                      <div className="absolute right-4 top-4 text-xs font-semibold px-2 py-1 rounded-full bg-gray-900 text-white">
                        Próximamente
                      </div>

                      <div className="flex items-start gap-3">
                        <div
                          className={classNames(
                            "h-10 w-10 rounded-xl flex items-center justify-center",
                            saleType === "auction"
                              ? "bg-orange-500 text-white"
                              : "bg-gray-100 text-gray-700"
                          )}
                        >
                          ⏱
                        </div>
                        <div className="flex-1">
                          <div className="font-bold text-gray-900">Subasta</div>
                          <div className="text-sm text-gray-600 mt-1">
                            Deja que los compradores pujen por tu entrada.
                          </div>
                        </div>
                      </div>
                    </button>
                  </div>

                  {/* Subasta automática (futuro) */}
                  <div className="mt-4 rounded-2xl border border-orange-200 bg-orange-50 p-4">
                    <label className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4"
                        checked={emergencyAuction}
                        onChange={(e) => setEmergencyAuction(e.target.checked)}
                        disabled
                      />
                      <div>
                        <p className="font-semibold text-orange-900">
                          Subasta automática de emergencia
                        </p>
                        <p className="text-sm text-orange-800 mt-1">
                          Si mi entrada no se vende, permite que se active
                          automáticamente una subasta 2 horas antes del evento.
                          (Esto lo activamos más adelante)
                        </p>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Footer botones */}
                <div className="mt-8 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => router.push("/")}
                    className="rounded-xl border border-gray-200 px-5 py-3 text-gray-700 hover:bg-gray-50"
                  >
                    Cancelar
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const err = validateStep1();
                      if (err) return alert(err);
                      setStep(2);
                    }}
                    className="rounded-xl bg-indigo-600 px-6 py-3 font-semibold text-white hover:bg-indigo-700"
                  >
                    Continuar
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2 */}
          {step === 2 && (
            <div className="space-y-8">
              <div className="rounded-2xl border border-gray-200 bg-white p-6 md:p-7">
                <SectionTitle
                  title="Sube tu archivo"
                  subtitle="Necesitamos el PDF para validar la entrada."
                />

                <div className="rounded-2xl border border-dashed border-gray-300 p-6">
                  <div className="flex flex-col md:flex-row md:items-center gap-4 justify-between">
                    <div>
                      <p className="font-semibold text-gray-900">
                        Ticket en PDF <span className="text-red-500">*</span>
                      </p>
                      <p className="text-sm text-gray-600 mt-1">
                        Solo PDF (máx. 10MB).
                      </p>
                    </div>

                    <label className="inline-flex cursor-pointer items-center justify-center rounded-xl bg-indigo-600 px-5 py-3 text-white font-semibold hover:bg-indigo-700">
                      Elegir archivo
                      <input
                        type="file"
                        accept="application/pdf,.pdf"
                        className="hidden"
                        onChange={(e) =>
                          handlePdfChange(e.target.files?.[0] || null)
                        }
                      />
                    </label>
                  </div>

                  {ticketPdf && (
                    <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 truncate">
                            {ticketPdf.name}
                          </p>
                          <p className="text-xs text-gray-600 mt-1">
                            {(ticketPdf.size / (1024 * 1024)).toFixed(2)} MB
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handlePdfChange(null)}
                          className="text-sm font-semibold text-gray-700 hover:text-gray-900"
                        >
                          Quitar
                        </button>
                      </div>
                    </div>
                  )}

                  {pdfError && (
                    <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">
                      {pdfError}
                    </div>
                  )}
                </div>

                <div className="mt-8 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="rounded-xl border border-gray-200 px-5 py-3 text-gray-700 hover:bg-gray-50"
                  >
                    Volver
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const err = validateStep2();
                      if (err) return alert(err);
                      setStep(3);
                    }}
                    className="rounded-xl bg-indigo-600 px-6 py-3 font-semibold text-white hover:bg-indigo-700"
                  >
                    Continuar
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3 */}
          {step === 3 && (
            <div className="space-y-8">
              <div className="rounded-2xl border border-gray-200 bg-white p-6 md:p-7">
                <SectionTitle
                  title="Confirmar"
                  subtitle="Revisa que todo esté OK antes de publicar."
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="rounded-2xl border border-gray-200 p-5">
                    <p className="text-xs font-semibold text-gray-500">
                      Evento
                    </p>
                    <p className="mt-1 font-bold text-gray-900">
                      {isManualEvent
                        ? manualEventTitle || "—"
                        : selectedEvent?.title || "—"}
                    </p>
                    <p className="text-sm text-gray-600 mt-1">
                      {isManualEvent
                        ? `${manualEventDate || "—"} • ${
                            manualEventLocation || "—"
                          }`
                        : selectedEvent
                        ? `${formatEventDate(selectedEvent.starts_at)} • ${
                            selectedEvent.venue || selectedEvent.city || "Chile"
                          }`
                        : "—"}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-gray-200 p-5">
                    <p className="text-xs font-semibold text-gray-500">
                      Precio de venta
                    </p>
                    <p className="mt-1 font-bold text-gray-900">
                      CLP ${formatCLP(ticketPrice || "0")}
                    </p>
                    <p className="text-sm text-gray-600 mt-1">
                      Tipo: {saleType === "fixed" ? "Precio fijo" : "Subasta"}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-gray-200 p-5 md:col-span-2">
                    <p className="text-xs font-semibold text-gray-500">
                      Entrada
                    </p>
                    <p className="mt-1 font-bold text-gray-900">
                      {ticketTitle || "—"}
                    </p>
                    {ticketDescription && (
                      <p className="text-sm text-gray-700 mt-2">
                        {ticketDescription}
                      </p>
                    )}
                    <p className="text-sm text-gray-600 mt-3">
                      Ubicación:{" "}
                      {[sector, row, seat].filter(Boolean).join(" • ") || "—"}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-gray-200 p-5 md:col-span-2">
                    <p className="text-xs font-semibold text-gray-500">
                      Archivo
                    </p>
                    <p className="mt-1 font-medium text-gray-900">
                      {ticketPdf?.name || "—"}
                    </p>
                  </div>
                </div>

                <div className="mt-8 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="rounded-xl border border-gray-200 px-5 py-3 text-gray-700 hover:bg-gray-50"
                  >
                    Volver
                  </button>

                  <button
                    type="button"
                    onClick={handlePublish}
                    className="rounded-xl bg-indigo-600 px-6 py-3 font-semibold text-white hover:bg-indigo-700"
                  >
                    Publicar
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Mini ayuda abajo */}
      <p className="text-center text-xs text-gray-500 mt-6">
        Tip: mientras más detalle pongas (sector/fila/asiento), más rápido se
        vende 💸
      </p>
    </div>
  );
}
