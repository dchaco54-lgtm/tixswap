"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabaseClient";

type EventRow = {
  id: string;
  title: string;
  starts_at: string | null;
  venue: string | null;
  city: string | null;
  image_url?: string | null;
};

type Step = 1 | 2 | 3;

function formatEventLabel(e: EventRow) {
  const date = e.starts_at
    ? new Date(e.starts_at).toLocaleString("es-CL", {
        day: "2-digit",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "Fecha por confirmar";

  const place = [e.venue, e.city].filter(Boolean).join(" · ");
  return `${e.title} — ${date}${place ? `, ${place}` : ""}`;
}

export default function SellPage() {
  const router = useRouter();

  // Auth
  const [userId, setUserId] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Events
  const [events, setEvents] = useState<EventRow[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [eventsError, setEventsError] = useState<string | null>(null);

  // Wizard
  const [step, setStep] = useState<Step>(1);

  // Form: Event selection
  const [eventNotInList, setEventNotInList] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string>("");

  // Form: manual event fields (when not in list)
  const [manualEventName, setManualEventName] = useState("");
  const [manualEventDate, setManualEventDate] = useState("");
  const [manualEventLocation, setManualEventLocation] = useState("");

  // Form: ticket fields
  const [ticketTitle, setTicketTitle] = useState("");
  const [description, setDescription] = useState("");
  const [sector, setSector] = useState("");
  const [row, setRow] = useState("");
  const [seat, setSeat] = useState("");
  const [price, setPrice] = useState("");
  const [originalPrice, setOriginalPrice] = useState("");

  // File (PDF)
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);

  // UI
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // 1) Auth gate
  useEffect(() => {
    let mounted = true;

    (async () => {
      setAuthLoading(true);
      const { data, error } = await supabase.auth.getUser();
      if (!mounted) return;

      if (error || !data?.user) {
        // misma lógica que vender: si no está logeado -> login
        router.push("/login?redirect=/sell");
        return;
      }

      setUserId(data.user.id);
      setAuthLoading(false);
    })();

    return () => {
      mounted = false;
    };
  }, [router]);

  // 2) Load events from Supabase
  useEffect(() => {
    if (!userId) return;

    let mounted = true;

    (async () => {
      setEventsLoading(true);
      setEventsError(null);

      const { data, error } = await supabase
        .from("events")
        .select("id,title,starts_at,venue,city,image_url")
        .order("starts_at", { ascending: true });

      if (!mounted) return;

      if (error) {
        setEvents([]);
        setEventsError("No pude cargar los eventos. Intenta de nuevo.");
      } else {
        setEvents((data ?? []) as EventRow[]);
      }

      setEventsLoading(false);
    })();

    return () => {
      mounted = false;
    };
  }, [userId]);

  const selectedEvent = useMemo(
    () => events.find((e) => e.id === selectedEventId) ?? null,
    [events, selectedEventId]
  );

  function validateStep1(): string | null {
    if (eventNotInList) {
      if (!manualEventName.trim()) return "Escribe el nombre del evento.";
      // fecha/ubicación las dejo opcionales (pero recomendado)
    } else {
      if (!selectedEventId) return "Selecciona un evento del listado.";
    }

    if (!ticketTitle.trim()) return "Completa el título de la entrada.";
    if (!price || Number(price) <= 0) return "Ingresa un precio de venta válido.";

    return null;
  }

  function validatePdf(file: File | null): string | null {
    if (!file) return "Debes adjuntar el PDF de la entrada.";
    const isPdf =
      file.type === "application/pdf" ||
      file.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) return "El archivo debe ser PDF.";
    return null;
  }

  function goNext() {
    setGlobalError(null);

    if (step === 1) {
      const err = validateStep1();
      if (err) return setGlobalError(err);
      setStep(2);
      return;
    }

    if (step === 2) {
      const err = validatePdf(pdfFile);
      setPdfError(err);
      if (err) return setGlobalError(err);
      setStep(3);
      return;
    }
  }

  function goBack() {
    setGlobalError(null);
    setPdfError(null);
    setStep((s) => (s === 1 ? 1 : ((s - 1) as Step)));
  }

  async function submitListing() {
    setGlobalError(null);
    setSubmitting(true);

    try {
      if (!userId) {
        router.push("/login?redirect=/sell");
        return;
      }

      // Validaciones finales
      const err1 = validateStep1();
      if (err1) {
        setGlobalError(err1);
        setSubmitting(false);
        return;
      }

      const errPdf = validatePdf(pdfFile);
      setPdfError(errPdf);
      if (errPdf) {
        setGlobalError(errPdf);
        setSubmitting(false);
        return;
      }

      // 1) Crear ticket/publicación
      const insertPayload: any = {
        user_id: userId,
        event_id: eventNotInList ? null : selectedEventId,
        title: ticketTitle.trim(),
        description: description?.trim() || null,
        sector: sector?.trim() || null,
        row: row?.trim() || null,
        seat: seat?.trim() || null,
        price: Number(price),
        original_price: originalPrice ? Number(originalPrice) : null,
        sale_type: "fixed",
        status: "published",
      };

      const { data: created, error: insertErr } = await supabase
        .from("tickets")
        .insert(insertPayload)
        .select("id")
        .single();

      if (insertErr || !created?.id) {
        throw new Error(
          insertErr?.message || "No se pudo crear la publicación."
        );
      }

      const ticketId = created.id as string;

      // 2) Subir PDF a Storage (si existe bucket). Si falla, NO botamos la publicación.
      //    Bucket recomendado: "tickets"
      if (pdfFile) {
        try {
          const path = `tickets/${userId}/${ticketId}.pdf`;

          const { error: upErr } = await supabase.storage
            .from("tickets")
            .upload(path, pdfFile, {
              upsert: true,
              contentType: "application/pdf",
            });

          // Si el bucket no existe o RLS/storage falla, seguimos igual.
          if (!upErr) {
            const { data: pub } = supabase.storage
              .from("tickets")
              .getPublicUrl(path);

            const publicUrl = pub?.publicUrl;

            // 3) Intentar guardar URL (si tu tabla tiene columna pdf_url / ticket_pdf_url, etc.)
            //    Si no existe la columna, esta update fallará y lo ignoramos.
            if (publicUrl) {
              await supabase
                .from("tickets")
                .update({ pdf_url: publicUrl })
                .eq("id", ticketId);
            }
          }
        } catch {
          // no-op
        }
      }

      // 3) Si el evento no existe, abrir ticket a soporte para que creen el evento
      if (eventNotInList) {
        const msg = [
          "📌 Solicitud de creación de evento (desde /sell)",
          "",
          `Evento: ${manualEventName || "-"}`,
          `Fecha: ${manualEventDate || "-"}`,
          `Ubicación: ${manualEventLocation || "-"}`,
          "",
          "🎫 Publicación ya creada:",
          `Ticket ID: ${ticketId}`,
          `Título entrada: ${ticketTitle}`,
          `Precio: ${price}`,
          `Sector: ${sector || "-"}`,
          `Fila: ${row || "-"}`,
          `Asiento: ${seat || "-"}`,
          `Descripción: ${description || "-"}`,
        ].join("\n");

        await supabase.from("support_tickets").insert({
          user_id: userId,
          category: "Eventos",
          subject: `Crear evento: ${manualEventName}`.slice(0, 120),
          message: msg,
          status: "open",
        });
      }

      // listo: redirigir al evento si existe, si no, al dashboard
      if (!eventNotInList && selectedEventId) {
        router.push(`/events/${selectedEventId}`);
      } else {
        router.push("/dashboard");
      }
    } catch (e: any) {
      setGlobalError(e?.message || "Ocurrió un error al publicar.");
    } finally {
      setSubmitting(false);
    }
  }

  // ---------- UI ----------
  if (authLoading) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-10">
        <div className="text-gray-600">Cargando...</div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <h1 className="text-4xl font-extrabold tracking-tight mb-6">
        Vender entrada
      </h1>

      {/* Steps */}
      <div className="border rounded-2xl bg-white shadow-sm overflow-hidden mb-6">
        <div className="grid grid-cols-3 text-sm">
          <div
            className={`px-6 py-4 ${
              step === 1 ? "font-semibold" : "text-gray-500"
            }`}
          >
            <span
              className={`inline-flex items-center justify-center w-6 h-6 rounded-full mr-2 ${
                step === 1 ? "bg-black text-white" : "bg-gray-200 text-gray-700"
              }`}
            >
              1
            </span>
            Detalles
          </div>

          <div
            className={`px-6 py-4 text-center ${
              step === 2 ? "font-semibold" : "text-gray-500"
            }`}
          >
            <span
              className={`inline-flex items-center justify-center w-6 h-6 rounded-full mr-2 ${
                step === 2 ? "bg-black text-white" : "bg-gray-200 text-gray-700"
              }`}
            >
              2
            </span>
            Archivo
          </div>

          <div
            className={`px-6 py-4 text-right ${
              step === 3 ? "font-semibold" : "text-gray-500"
            }`}
          >
            <span
              className={`inline-flex items-center justify-center w-6 h-6 rounded-full mr-2 ${
                step === 3 ? "bg-black text-white" : "bg-gray-200 text-gray-700"
              }`}
            >
              3
            </span>
            Confirmar
          </div>
        </div>
      </div>

      {/* Errors */}
      {(globalError || eventsError) && (
        <div className="mb-6 border rounded-2xl p-4 bg-red-50 text-red-700">
          {globalError || eventsError}
        </div>
      )}

      {/* STEP 1 */}
      {step === 1 && (
        <div className="border rounded-2xl bg-white shadow-sm p-8">
          <h2 className="text-2xl font-bold mb-6">Detalles de la entrada</h2>

          <div className="mb-5">
            <label className="flex items-start gap-3 select-none">
              <input
                type="checkbox"
                className="mt-1"
                checked={eventNotInList}
                onChange={(e) => {
                  setEventNotInList(e.target.checked);
                  setSelectedEventId("");
                }}
              />
              <div>
                <div className="font-medium">Mi evento no está en el listado</div>
                <div className="text-sm text-gray-600">
                  Puedes publicarla igual y avisamos a soporte para completar el evento.
                </div>
              </div>
            </label>
          </div>

          {!eventNotInList ? (
            <div className="mb-5">
              <label className="block text-sm font-medium mb-2">
                Evento <span className="text-red-600">*</span>
              </label>

              <select
                className="w-full border rounded-xl px-4 py-3 bg-white"
                value={selectedEventId}
                onChange={(e) => setSelectedEventId(e.target.value)}
                disabled={eventsLoading}
              >
                <option value="">
                  {eventsLoading ? "Cargando eventos..." : "Selecciona un evento..."}
                </option>
                {events.map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    {formatEventLabel(ev)}
                  </option>
                ))}
              </select>

              {!eventsLoading && events.length === 0 && (
                <div className="text-sm text-red-600 mt-2">
                  No hay eventos cargados. Crea uno en <span className="font-medium">/admin/events</span>.
                </div>
              )}
            </div>
          ) : (
            <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Nombre del evento <span className="text-red-600">*</span>
                </label>
                <input
                  className="w-full border rounded-xl px-4 py-3"
                  value={manualEventName}
                  onChange={(e) => setManualEventName(e.target.value)}
                  placeholder="Ej: Chayanne"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Fecha (opcional)</label>
                <input
                  className="w-full border rounded-xl px-4 py-3"
                  value={manualEventDate}
                  onChange={(e) => setManualEventDate(e.target.value)}
                  placeholder="Ej: 08/02/2026 21:00"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-2">
                  Ubicación (opcional)
                </label>
                <input
                  className="w-full border rounded-xl px-4 py-3"
                  value={manualEventLocation}
                  onChange={(e) => setManualEventLocation(e.target.value)}
                  placeholder="Ej: Estadio Nacional, Santiago"
                />
              </div>
            </div>
          )}

          <div className="mb-5">
            <label className="block text-sm font-medium mb-2">
              Título de la entrada <span className="text-red-600">*</span>
            </label>
            <input
              className="w-full border rounded-xl px-4 py-3"
              value={ticketTitle}
              onChange={(e) => setTicketTitle(e.target.value)}
              placeholder="Ej: Entrada General - Platea Alta"
            />
          </div>

          <div className="mb-5">
            <label className="block text-sm font-medium mb-2">Descripción</label>
            <textarea
              className="w-full border rounded-xl px-4 py-3 min-h-[110px]"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe tu entrada (ubicación específica, estado, restricciones, etc.)"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
            <div>
              <label className="block text-sm font-medium mb-2">Sector</label>
              <input
                className="w-full border rounded-xl px-4 py-3"
                value={sector}
                onChange={(e) => setSector(e.target.value)}
                placeholder="Cancha, Platea, etc."
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Fila</label>
              <input
                className="w-full border rounded-xl px-4 py-3"
                value={row}
                onChange={(e) => setRow(e.target.value)}
                placeholder="A, B, 1, 2, etc."
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Asiento</label>
              <input
                className="w-full border rounded-xl px-4 py-3"
                value={seat}
                onChange={(e) => setSeat(e.target.value)}
                placeholder="1, 2, 3, etc."
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            <div>
              <label className="block text-sm font-medium mb-2">
                Precio de venta <span className="text-red-600">*</span>
              </label>
              <input
                type="number"
                className="w-full border rounded-xl px-4 py-3"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="50000"
                min={0}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">
                Precio original (opcional)
              </label>
              <input
                type="number"
                className="w-full border rounded-xl px-4 py-3"
                value={originalPrice}
                onChange={(e) => setOriginalPrice(e.target.value)}
                placeholder="65000"
                min={0}
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3">
            <button
              className="px-5 py-3 rounded-xl border hover:bg-gray-50"
              onClick={() => router.push("/events")}
            >
              Cancelar
            </button>
            <button
              className="px-5 py-3 rounded-xl bg-black text-white hover:bg-gray-900"
              onClick={goNext}
            >
              Continuar
            </button>
          </div>
        </div>
      )}

      {/* STEP 2 */}
      {step === 2 && (
        <div className="border rounded-2xl bg-white shadow-sm p-8">
          <h2 className="text-2xl font-bold mb-2">Archivo</h2>
          <p className="text-gray-600 mb-6">
            Adjunta el <span className="font-medium">PDF</span> de tu entrada. (Solo PDF)
          </p>

          <div className="border rounded-2xl p-6 bg-gray-50">
            <label className="block text-sm font-medium mb-3">
              Subir PDF <span className="text-red-600">*</span>
            </label>

            <input
              type="file"
              accept="application/pdf,.pdf"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                setPdfFile(f);

                const err = validatePdf(f);
                setPdfError(err);
                if (err) setGlobalError(err);
                else setGlobalError(null);
              }}
              className="block w-full"
            />

            {pdfFile && !pdfError && (
              <div className="mt-3 text-sm text-green-700">
                Listo: <span className="font-medium">{pdfFile.name}</span>
              </div>
            )}

            {pdfError && (
              <div className="mt-3 text-sm text-red-600">{pdfError}</div>
            )}

            <div className="mt-4 text-xs text-gray-500">
              Tip: si tienes imagen (PNG/JPG) desde Puntoticket, conviértela a PDF y listo.
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 mt-8">
            <button
              className="px-5 py-3 rounded-xl border hover:bg-gray-50"
              onClick={goBack}
            >
              Volver
            </button>
            <button
              className="px-5 py-3 rounded-xl bg-black text-white hover:bg-gray-900"
              onClick={goNext}
            >
              Continuar
            </button>
          </div>
        </div>
      )}

      {/* STEP 3 */}
      {step === 3 && (
        <div className="border rounded-2xl bg-white shadow-sm p-8">
          <h2 className="text-2xl font-bold mb-6">Confirmar publicación</h2>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <div className="border rounded-2xl p-6 bg-gray-50">
              <div className="text-sm text-gray-600 mb-1">Evento</div>
              <div className="font-semibold">
                {eventNotInList
                  ? manualEventName || "(sin nombre)"
                  : selectedEvent
                  ? selectedEvent.title
                  : "(sin seleccionar)"}
              </div>
              <div className="text-sm text-gray-600 mt-2">
                {eventNotInList
                  ? [manualEventDate, manualEventLocation].filter(Boolean).join(" · ") ||
                    "Se completará con soporte"
                  : selectedEvent
                  ? [selectedEvent.venue, selectedEvent.city].filter(Boolean).join(" · ")
                  : ""}
              </div>
            </div>

            <div className="border rounded-2xl p-6 bg-gray-50">
              <div className="text-sm text-gray-600 mb-1">Archivo</div>
              <div className="font-semibold">
                {pdfFile ? pdfFile.name : "(sin archivo)"}
              </div>
              <div className="text-sm text-gray-600 mt-2">
                Solo PDF · Validación automática
              </div>
            </div>

            <div className="border rounded-2xl p-6 bg-gray-50 lg:col-span-2">
              <div className="font-semibold mb-3">Entrada</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-gray-600">Título:</span>{" "}
                  <span className="font-medium">{ticketTitle}</span>
                </div>
                <div>
                  <span className="text-gray-600">Precio:</span>{" "}
                  <span className="font-medium">${Number(price).toLocaleString("es-CL")}</span>
                </div>
                <div>
                  <span className="text-gray-600">Sector:</span>{" "}
                  <span className="font-medium">{sector || "-"}</span>
                </div>
                <div>
                  <span className="text-gray-600">Fila/Asiento:</span>{" "}
                  <span className="font-medium">
                    {row || "-"} / {seat || "-"}
                  </span>
                </div>
                {description && (
                  <div className="md:col-span-2">
                    <span className="text-gray-600">Descripción:</span>{" "}
                    <span className="font-medium">{description}</span>
                  </div>
                )}
              </div>

              {eventNotInList && (
                <div className="mt-4 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3">
                  Ojo: como el evento no está en el listado, vamos a crear un ticket a soporte para que lo agreguen.
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-end gap-3">
            <button
              className="px-5 py-3 rounded-xl border hover:bg-gray-50"
              onClick={goBack}
              disabled={submitting}
            >
              Volver
            </button>

            <button
              className="px-5 py-3 rounded-xl bg-black text-white hover:bg-gray-900 disabled:opacity-60"
              onClick={submitListing}
              disabled={submitting}
            >
              {submitting ? "Publicando..." : "Publicar entrada"}
            </button>
          </div>
        </div>
      )}

      {/* Debug helpers (opcionales) */}
      <div className="mt-6 text-xs text-gray-400">
        {eventsLoading ? "Cargando eventos..." : `Eventos cargados: ${events.length}`}
      </div>
    </div>
  );
}
