"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabaseClient";

function formatDate(dateString?: string) {
  if (!dateString) return "";
  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("es-CL", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function SellPage() {
  const router = useRouter();

  const [step, setStep] = useState<1 | 2 | 3>(1);

  const [events, setEvents] = useState<any[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [eventsError, setEventsError] = useState<string | null>(null);

  // Form fields
  const [eventId, setEventId] = useState("");
  const [manualEvent, setManualEvent] = useState(false);

  const [ticketTitle, setTicketTitle] = useState("");
  const [ticketDescription, setTicketDescription] = useState("");
  const [ticketPrice, setTicketPrice] = useState("");
  const [ticketFile, setTicketFile] = useState<File | null>(null);

  const [fileError, setFileError] = useState<string | null>(null);

  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);

  // Auth check
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data?.session) {
        router.push("/login?redirect=/sell");
      }
    })();
  }, [router]);

  // Load events
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setEventsLoading(true);
        setEventsError(null);

        const { data, error } = await supabase
          .from("events")
          .select("id, name, date, location")
          .order("date", { ascending: true });

        if (error) throw error;
        if (!mounted) return;

        setEvents(Array.isArray(data) ? data : []);
      } catch (e: any) {
        if (!mounted) return;
        setEventsError("No pude cargar los eventos. Intenta de nuevo.");
        setEvents([]);
      } finally {
        if (!mounted) return;
        setEventsLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const selectedEvent = useMemo(() => {
    if (!eventId) return null;
    return events.find((e) => e.id === eventId) || null;
  }, [eventId, events]);

  const canGoStep2 = useMemo(() => {
    if (manualEvent) {
      return ticketTitle.trim().length > 0 && Number(ticketPrice) > 0;
    }
    return (
      !!eventId &&
      ticketTitle.trim().length > 0 &&
      Number(ticketPrice) > 0 &&
      !eventsLoading
    );
  }, [manualEvent, eventId, ticketTitle, ticketPrice, eventsLoading]);

  const canGoStep3 = useMemo(() => {
    return !!ticketFile && !fileError;
  }, [ticketFile, fileError]);

  function validatePdf(file: File) {
    const nameOk = file.name.toLowerCase().endsWith(".pdf");
    const typeOk = file.type === "application/pdf";
    return nameOk || typeOk;
  }

  function handleFileChange(f: File | null) {
    setPublishError(null);

    if (!f) {
      setTicketFile(null);
      setFileError(null);
      return;
    }

    // ✅ SOLO PDF
    if (!validatePdf(f)) {
      setTicketFile(null);
      setFileError("Solo se permite subir un archivo PDF.");
      return;
    }

    setFileError(null);
    setTicketFile(f);
  }

  async function handlePublish() {
    setPublishError(null);

    // guardrails
    if (!manualEvent && !eventId) {
      setPublishError("Selecciona un evento.");
      return;
    }
    if (!ticketTitle.trim()) {
      setPublishError("Ingresa el título de la entrada.");
      return;
    }
    if (!(Number(ticketPrice) > 0)) {
      setPublishError("Ingresa un precio válido.");
      return;
    }
    if (!ticketFile) {
      setPublishError("Sube tu entrada en PDF para continuar.");
      return;
    }
    if (fileError) {
      setPublishError(fileError);
      return;
    }

    try {
      setPublishing(true);

      // TODO: acá después subimos el PDF a Storage + guardamos URL en la tabla
      // Por ahora: creamos el registro base (como lo tenías)
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData?.session?.user?.id;

      const payload: any = {
        event_id: manualEvent ? null : eventId,
        title: ticketTitle.trim(),
        description: ticketDescription?.trim() || null,
        price: Number(ticketPrice),
        seller_id: userId ?? null,
        status: "pending_upload", // o el status que uses
      };

      const { error } = await supabase.from("tickets").insert(payload);

      if (error) throw error;

      router.push("/account?success=1");
    } catch (e: any) {
      setPublishError(e?.message || "No se pudo publicar. Intenta de nuevo.");
    } finally {
      setPublishing(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10">
      <h1 className="text-4xl font-bold text-gray-900">Vender entrada</h1>

      {/* Stepper (se mantiene estilo base) */}
      <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between text-sm text-gray-600">
          <div className={`flex items-center gap-2 ${step === 1 ? "font-semibold text-gray-900" : ""}`}>
            <span className={`flex h-6 w-6 items-center justify-center rounded-full border ${step >= 1 ? "border-blue-600 text-blue-600" : "border-gray-300 text-gray-400"}`}>
              1
            </span>
            <span>Detalles</span>
          </div>

          <div className="mx-4 hidden h-px flex-1 bg-gray-200 sm:block" />

          <div className={`flex items-center gap-2 ${step === 2 ? "font-semibold text-gray-900" : ""}`}>
            <span className={`flex h-6 w-6 items-center justify-center rounded-full border ${step >= 2 ? "border-blue-600 text-blue-600" : "border-gray-300 text-gray-400"}`}>
              2
            </span>
            <span>Archivo</span>
          </div>

          <div className="mx-4 hidden h-px flex-1 bg-gray-200 sm:block" />

          <div className={`flex items-center gap-2 ${step === 3 ? "font-semibold text-gray-900" : ""}`}>
            <span className={`flex h-6 w-6 items-center justify-center rounded-full border ${step >= 3 ? "border-blue-600 text-blue-600" : "border-gray-300 text-gray-400"}`}>
              3
            </span>
            <span>Confirmar</span>
          </div>
        </div>
      </div>

      {/* Errors */}
      {eventsError && (
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
          {eventsError}
        </div>
      )}

      {publishError && (
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
          {publishError}
        </div>
      )}

      {/* Step 1 */}
      {step === 1 && (
        <div className="mt-8 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-semibold text-gray-900">Detalles de la entrada</h2>

          <div className="mt-6">
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4"
                checked={manualEvent}
                onChange={(e) => {
                  setManualEvent(e.target.checked);
                  setEventId("");
                }}
              />
              <div>
                <div className="font-medium text-gray-900">Mi evento no está en el listado</div>
                <div className="text-sm text-gray-600">
                  Puedes publicarla igual y avisamos a soporte para completar el evento.
                </div>
              </div>
            </label>
          </div>

          <div className="mt-6 grid gap-6 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-900">
                Evento <span className="text-red-600">*</span>
              </label>
              <select
                disabled={manualEvent || eventsLoading}
                value={eventId}
                onChange={(e) => setEventId(e.target.value)}
                className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-gray-900 outline-none focus:border-blue-500"
              >
                <option value="">
                  {eventsLoading ? "Cargando eventos..." : "Selecciona un evento..."}
                </option>
                {events.map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    {ev.name} — {formatDate(ev.date)} {ev.location ? `— ${ev.location}` : ""}
                  </option>
                ))}
              </select>

              {!manualEvent && !eventsLoading && events.length === 0 && (
                <div className="mt-2 text-sm text-red-600">
                  No hay eventos cargados. Crea uno en <span className="font-semibold">/admin/events</span>.
                </div>
              )}

              {selectedEvent && (
                <div className="mt-2 text-sm text-gray-600">
                  Seleccionado: <span className="font-medium text-gray-900">{selectedEvent.name}</span>
                </div>
              )}
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-900">
                Título de la entrada <span className="text-red-600">*</span>
              </label>
              <input
                value={ticketTitle}
                onChange={(e) => setTicketTitle(e.target.value)}
                placeholder="Ej: Entrada General - Platea Alta"
                className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-gray-900 outline-none focus:border-blue-500"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-900">Descripción</label>
              <textarea
                value={ticketDescription}
                onChange={(e) => setTicketDescription(e.target.value)}
                placeholder="Describe tu entrada (ubicación específica, estado, restricciones, etc.)"
                rows={4}
                className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-gray-900 outline-none focus:border-blue-500"
              />
            </div>

            <div className="md:col-span-1">
              <label className="block text-sm font-medium text-gray-900">
                Precio <span className="text-red-600">*</span>
              </label>
              <input
                inputMode="numeric"
                value={ticketPrice}
                onChange={(e) => setTicketPrice(e.target.value.replace(/[^\d]/g, ""))}
                placeholder="Ej: 30000"
                className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-gray-900 outline-none focus:border-blue-500"
              />
              <div className="mt-1 text-xs text-gray-500">Sin puntos ni comas.</div>
            </div>
          </div>

          <div className="mt-8 flex items-center justify-end">
            <button
              onClick={() => setStep(2)}
              disabled={!canGoStep2}
              className={`rounded-xl px-5 py-3 text-sm font-semibold ${
                canGoStep2
                  ? "bg-blue-600 text-white hover:bg-blue-700"
                  : "bg-gray-200 text-gray-500 cursor-not-allowed"
              }`}
            >
              Continuar
            </button>
          </div>
        </div>
      )}

      {/* Step 2 */}
      {step === 2 && (
        <div className="mt-8 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-semibold text-gray-900">Sube tu entrada (PDF)</h2>
          <p className="mt-2 text-sm text-gray-600">
            Sube el archivo PDF de tu ticket. Si no es PDF, no te vamos a dejar avanzar.
          </p>

          <div className="mt-6 rounded-xl border border-dashed border-gray-300 p-6">
            <label className="block text-sm font-medium text-gray-900">Archivo PDF</label>
            <input
              type="file"
              accept=".pdf,application/pdf"
              onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
              className="mt-3 block w-full text-sm text-gray-700"
            />

            {fileError && (
              <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {fileError}
              </div>
            )}

            {ticketFile && !fileError && (
              <div className="mt-3 text-sm text-gray-700">
                Archivo seleccionado: <span className="font-medium">{ticketFile.name}</span>
              </div>
            )}
          </div>

          <div className="mt-8 flex items-center justify-between">
            <button
              onClick={() => setStep(1)}
              className="rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-semibold text-gray-900 hover:bg-gray-50"
            >
              Volver
            </button>

            <button
              onClick={() => setStep(3)}
              disabled={!canGoStep3}
              className={`rounded-xl px-5 py-3 text-sm font-semibold ${
                canGoStep3
                  ? "bg-blue-600 text-white hover:bg-blue-700"
                  : "bg-gray-200 text-gray-500 cursor-not-allowed"
              }`}
            >
              Continuar
            </button>
          </div>
        </div>
      )}

      {/* Step 3 */}
      {step === 3 && (
        <div className="mt-8 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-semibold text-gray-900">Confirma tu publicación</h2>

          <div className="mt-6 space-y-3 rounded-xl border border-gray-200 bg-gray-50 p-5 text-sm text-gray-800">
            <div>
              <span className="text-gray-600">Evento:</span>{" "}
              <span className="font-medium">
                {manualEvent ? "No está en listado (manual)" : selectedEvent?.name || "—"}
              </span>
            </div>
            <div>
              <span className="text-gray-600">Título:</span>{" "}
              <span className="font-medium">{ticketTitle || "—"}</span>
            </div>
            <div>
              <span className="text-gray-600">Precio:</span>{" "}
              <span className="font-medium">${Number(ticketPrice || 0).toLocaleString("es-CL")}</span>
            </div>
            <div>
              <span className="text-gray-600">Archivo:</span>{" "}
              <span className="font-medium">{ticketFile?.name || "—"}</span>
            </div>
          </div>

          <div className="mt-8 flex items-center justify-between">
            <button
              onClick={() => setStep(2)}
              className="rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-semibold text-gray-900 hover:bg-gray-50"
            >
              Volver
            </button>

            <button
              onClick={handlePublish}
              disabled={publishing}
              className={`rounded-xl px-5 py-3 text-sm font-semibold ${
                publishing ? "bg-gray-200 text-gray-500" : "bg-blue-600 text-white hover:bg-blue-700"
              }`}
            >
              {publishing ? "Publicando..." : "Publicar entrada"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
