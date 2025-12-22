"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

type DbEvent = {
  id: string;
  title: string;
  starts_at: string | null;
  venue: string | null;
  city: string | null;
};

type Step = 1 | 2 | 3;

function formatEventLine(ev: DbEvent) {
  const parts = [
    ev.title?.trim(),
    ev.venue ? `• ${ev.venue}` : null,
    ev.city ? `• ${ev.city}` : null,
  ].filter(Boolean);
  return parts.join(" ");
}

function toCLP(n: number) {
  return new Intl.NumberFormat("es-CL").format(n);
}

async function uploadPdfToStorage(file: File, userId: string) {
  // Buckets a probar (para no depender de 1 nombre)
  const bucketsToTry = ["ticket-files", "tickets", "ticket_pdfs", "ticket-pdfs"];
  const safeName = file.name.replace(/[^\w.\-]+/g, "_");
  const path = `${userId}/${Date.now()}_${safeName}`;

  let lastErr: any = null;

  for (const bucket of bucketsToTry) {
    const upload = await supabase.storage.from(bucket).upload(path, file, {
      contentType: "application/pdf",
      upsert: false,
    });

    if (upload.error) {
      lastErr = upload.error;
      continue;
    }

    // Prefer signed url (sirve si bucket es privado)
    const signed = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60 * 24 * 365);
    if (!signed.error && signed.data?.signedUrl) {
      return { bucket, path, url: signed.data.signedUrl };
    }

    // Fallback public
    const pub = supabase.storage.from(bucket).getPublicUrl(path);
    if (pub.data?.publicUrl) {
      return { bucket, path, url: pub.data.publicUrl };
    }

    return { bucket, path, url: "" };
  }

  throw lastErr ?? new Error("No se pudo subir el archivo");
}

export default function SellPage() {
  const router = useRouter();

  // auth
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  // events
  const [events, setEvents] = useState<DbEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [eventSearch, setEventSearch] = useState("");
  const [selectedEventId, setSelectedEventId] = useState("");

  // flow
  const [step, setStep] = useState<Step>(1);
  const [submitting, setSubmitting] = useState(false);

  // form
  const [customEvent, setCustomEvent] = useState(false);
  const [customEventTitle, setCustomEventTitle] = useState("");
  const [customEventDate, setCustomEventDate] = useState("");
  const [customEventVenue, setCustomEventVenue] = useState("");

  const [ticketTitle, setTicketTitle] = useState("");
  const [description, setDescription] = useState("");
  const [sector, setSector] = useState("");
  const [row, setRow] = useState("");
  const [seat, setSeat] = useState("");

  const [price, setPrice] = useState("");
  const [originalPrice, setOriginalPrice] = useState("");

  // sale type
  const [saleType, setSaleType] = useState<"fixed" | "auction">("fixed"); // auction = futuro

  // PDF
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);

  const filteredEvents = useMemo(() => {
    const q = eventSearch.trim().toLowerCase();
    if (!q) return events;
    return events.filter((e) => {
      const hay = `${e.title ?? ""} ${e.venue ?? ""} ${e.city ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [events, eventSearch]);

  useEffect(() => {
    let mounted = true;

    (async () => {
      const { data } = await supabase.auth.getUser();
      const u = data?.user ?? null;

      if (!u?.id) {
        router.push("/login?redirect=/sell");
        return;
      }

      if (!mounted) return;

      setUserId(u.id);
      setUserEmail(u.email ?? null);

      // load events
      try {
        setEventsLoading(true);
        setEventsError(null);

        const { data: evs, error } = await supabase
          .from("events")
          .select("id,title,starts_at,venue,city")
          .order("starts_at", { ascending: true });

        if (error) throw error;

        setEvents((evs ?? []) as DbEvent[]);
      } catch (e: any) {
        setEventsError(e?.message ?? "No pude cargar los eventos.");
      } finally {
        setEventsLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [router]);

  const canGoStep2 = useMemo(() => {
    if (!ticketTitle.trim()) return false;
    if (!price.trim() || Number(price) <= 0) return false;

    if (customEvent) {
      if (!customEventTitle.trim()) return false;
      if (!customEventDate.trim()) return false;
      if (!customEventVenue.trim()) return false;
      return true;
    }

    return !!selectedEventId;
  }, [ticketTitle, price, customEvent, customEventTitle, customEventDate, customEventVenue, selectedEventId]);

  const canGoStep3 = useMemo(() => {
    return !!pdfFile && !pdfError;
  }, [pdfFile, pdfError]);

  function StepPill({ n, label }: { n: Step; label: string }) {
    const active = step === n;
    const done = step > n;

    return (
      <div className="flex items-center gap-3">
        <div
          className={[
            "h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold",
            active ? "bg-white text-indigo-700" : done ? "bg-white/80 text-indigo-700" : "bg-white/20 text-white",
          ].join(" ")}
        >
          {n}
        </div>
        <div className={["text-sm font-semibold", active || done ? "text-white" : "text-white/70"].join(" ")}>
          {label}
        </div>
      </div>
    );
  }

  function onPickPdf(file: File | null) {
    setPdfError(null);

    if (!file) {
      setPdfFile(null);
      return;
    }

    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) {
      setPdfFile(null);
      setPdfError("Solo se permite PDF.");
      return;
    }

    const maxMB = 15;
    if (file.size > maxMB * 1024 * 1024) {
      setPdfFile(null);
      setPdfError(`El PDF es muy pesado. Máximo ${maxMB}MB.`);
      return;
    }

    setPdfFile(file);
  }

  async function createSupportTicket(pdfUrl?: string) {
    if (!userId) throw new Error("No hay sesión.");

    const subject = `Solicitud creación de evento: ${customEventTitle}`;
    const msgLines = [
      `Usuario: ${userEmail ?? userId}`,
      `Evento (nuevo): ${customEventTitle}`,
      `Fecha (texto): ${customEventDate}`,
      `Lugar: ${customEventVenue}`,
      "",
      `Entrada: ${ticketTitle}`,
      `Precio: $${toCLP(Number(price))}`,
      originalPrice ? `Precio original: $${toCLP(Number(originalPrice))}` : null,
      sector ? `Sector: ${sector}` : null,
      row ? `Fila: ${row}` : null,
      seat ? `Asiento: ${seat}` : null,
      description ? `Descripción: ${description}` : null,
      pdfUrl ? `PDF: ${pdfUrl}` : null,
    ].filter(Boolean);

    const { error } = await supabase.from("support_tickets").insert([
      {
        user_id: userId,
        category: "event_request",
        subject,
        message: msgLines.join("\n"),
        status: "open",
      },
    ]);

    if (error) throw error;
  }

  async function publishTicket(pdfUrl?: string) {
    if (!userId) throw new Error("No hay sesión.");

    const payload: any = {
      event_id: selectedEventId,
      title: ticketTitle.trim(),
      description: description.trim() || null,
      sector: sector.trim() || null,
      row: row.trim() || null,
      seat: seat.trim() || null,
      price: Number(price),
      original_price: originalPrice ? Number(originalPrice) : null,
      sale_type: saleType, // fixed
    };

    if (pdfUrl) payload.pdf_url = pdfUrl;

    // Intento 1: con pdf_url
    let { error } = await supabase.from("tickets").insert([payload]);

    // Si no existe la columna pdf_url, reintenta sin ella (para no romper publicación)
    if (error && String(error.message || "").toLowerCase().includes("pdf_url")) {
      const { pdf_url, ...withoutPdf } = payload;
      const retry = await supabase.from("tickets").insert([withoutPdf]);
      if (retry.error) throw retry.error;

      alert(
        "Entrada publicada ✅\n" +
          "Pero tu tabla 'tickets' no tiene la columna 'pdf_url'.\n" +
          "Si quieres guardar el PDF en BD, crea la columna en Supabase."
      );
      return;
    }

    if (error) throw error;
  }

  async function onSubmitFinal() {
    if (submitting) return;
    if (!userId) return;

    try {
      setSubmitting(true);

      if (!pdfFile) {
        alert("Sube tu PDF para continuar.");
        return;
      }

      // Subir PDF
      let pdfUrl = "";
      try {
        const up = await uploadPdfToStorage(pdfFile, userId);
        pdfUrl = up.url;
      } catch (e) {
        alert(
          "No pude subir el PDF.\n" +
            "Revisa que exista un bucket en Supabase Storage (ej: 'tickets' o 'ticket-files') y sus permisos."
        );
        return;
      }

      // Evento nuevo => soporte
      if (customEvent) {
        await createSupportTicket(pdfUrl);
        alert("Listo ✅ Mandé la solicitud a Soporte para crear el evento.");
        router.push("/dashboard");
        return;
      }

      // Evento existente => publicar ticket
      await publishTicket(pdfUrl);
      alert("Entrada publicada ✅");
      router.push(`/events/${selectedEventId}`);
    } catch (e: any) {
      alert(e?.message ?? "Error publicando.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-white">
      <div className="max-w-5xl mx-auto px-6 py-10">
        <h1 className="text-4xl font-extrabold tracking-tight text-gray-900">Vender entrada</h1>
        <p className="mt-2 text-gray-600">
          Publica tu entrada con respaldo. Elige evento, completa detalles y sube tu PDF.
        </p>

        {/* Header / steps */}
        <div className="mt-8 rounded-2xl overflow-hidden shadow-sm border border-gray-200">
          <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 px-8 py-7">
            <div className="text-white text-2xl font-extrabold">Vender entrada</div>

            <div className="mt-6 flex items-center justify-between">
              <StepPill n={1} label="Detalles" />
              <div className="h-0.5 flex-1 mx-6 bg-white/20 rounded" />
              <StepPill n={2} label="Archivo" />
              <div className="h-0.5 flex-1 mx-6 bg-white/20 rounded" />
              <StepPill n={3} label="Confirmar" />
            </div>
          </div>

          {/* Body */}
          <div className="bg-white px-8 py-8">
            {/* STEP 1 */}
            {step === 1 && (
              <div className="space-y-8">
                <div className="rounded-2xl border border-gray-200 p-6">
                  <h2 className="text-2xl font-extrabold text-gray-900">Detalles de la entrada</h2>

                  <div className="mt-5 flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={customEvent}
                      onChange={(e) => setCustomEvent(e.target.checked)}
                      className="mt-1 h-4 w-4 rounded border-gray-300"
                    />
                    <div>
                      <div className="font-semibold text-gray-900">Mi evento no está en el listado</div>
                      <div className="text-sm text-gray-600">
                        Puedes dejar la solicitud y Soporte lo crea para completar el evento.
                      </div>
                    </div>
                  </div>

                  {!customEvent ? (
                    <div className="mt-6 grid grid-cols-1 gap-3">
                      <label className="text-sm font-semibold text-gray-900">Evento *</label>

                      <input
                        value={eventSearch}
                        onChange={(e) => setEventSearch(e.target.value)}
                        placeholder="Escribe para buscar (ej: Chayanne, Doja Cat...)"
                        className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500"
                      />

                      <select
                        value={selectedEventId}
                        onChange={(e) => setSelectedEventId(e.target.value)}
                        className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500"
                        disabled={eventsLoading}
                      >
                        <option value="">
                          {eventsLoading ? "Cargando eventos..." : "Selecciona un evento"}
                        </option>
                        {filteredEvents.map((ev) => (
                          <option key={ev.id} value={ev.id}>
                            {formatEventLine(ev)}
                          </option>
                        ))}
                      </select>

                      {eventsError ? (
                        <div className="text-sm text-red-600">{eventsError}</div>
                      ) : events.length === 0 && !eventsLoading ? (
                        <div className="text-sm text-red-600">
                          No hay eventos cargados. Importa/crea desde <b>/admin/events</b>.
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="md:col-span-2">
                        <label className="text-sm font-semibold text-gray-900">Nombre del evento *</label>
                        <input
                          value={customEventTitle}
                          onChange={(e) => setCustomEventTitle(e.target.value)}
                          placeholder="Ej: Festival X 2026"
                          className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>

                      <div>
                        <label className="text-sm font-semibold text-gray-900">Fecha (texto) *</label>
                        <input
                          value={customEventDate}
                          onChange={(e) => setCustomEventDate(e.target.value)}
                          placeholder="Ej: 10 de febrero 2026, 21:00"
                          className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>

                      <div>
                        <label className="text-sm font-semibold text-gray-900">Lugar *</label>
                        <input
                          value={customEventVenue}
                          onChange={(e) => setCustomEventVenue(e.target.value)}
                          placeholder="Ej: Movistar Arena - Santiago"
                          className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                    </div>
                  )}

                  <div className="mt-8 grid grid-cols-1 gap-4">
                    <div>
                      <label className="text-sm font-semibold text-gray-900">Título de la entrada *</label>
                      <input
                        value={ticketTitle}
                        onChange={(e) => setTicketTitle(e.target.value)}
                        placeholder="Ej: Entrada General - Platea Alta"
                        className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="text-sm font-semibold text-gray-900">Descripción</label>
                      <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Ubicación específica, estado, restricciones, etc."
                        className="mt-2 w-full min-h-[110px] rounded-xl border border-gray-300 px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="text-sm font-semibold text-gray-900">Sector</label>
                        <input
                          value={sector}
                          onChange={(e) => setSector(e.target.value)}
                          placeholder="Campo, Platea, etc."
                          className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-semibold text-gray-900">Fila</label>
                        <input
                          value={row}
                          onChange={(e) => setRow(e.target.value)}
                          placeholder="A, B, 1, 2, etc."
                          className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-semibold text-gray-900">Asiento</label>
                        <input
                          value={seat}
                          onChange={(e) => setSeat(e.target.value)}
                          placeholder="1, 2, 3, etc."
                          className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-semibold text-gray-900">Precio de venta *</label>
                        <input
                          value={price}
                          onChange={(e) => setPrice(e.target.value.replace(/[^\d]/g, ""))}
                          placeholder="50000"
                          className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                        {price ? (
                          <div className="mt-1 text-xs text-gray-500">≈ ${toCLP(Number(price))}</div>
                        ) : null}
                      </div>

                      <div>
                        <label className="text-sm font-semibold text-gray-900">Precio original (opcional)</label>
                        <input
                          value={originalPrice}
                          onChange={(e) => setOriginalPrice(e.target.value.replace(/[^\d]/g, ""))}
                          placeholder="60000"
                          className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-semibold text-gray-900">Tipo de venta</label>
                        <select
                          value={saleType}
                          onChange={(e) => setSaleType(e.target.value as any)}
                          className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                          <option value="fixed">Precio fijo</option>
                          <option value="auction" disabled>
                            Remate (próximamente)
                          </option>
                        </select>
                        <div className="mt-1 text-xs text-gray-500">
                          Remate queda listo como opción futura (deshabilitado por ahora).
                        </div>
                      </div>

                      <div className="rounded-xl border border-gray-200 p-4 bg-gray-50">
                        <div className="text-sm font-semibold text-gray-900">Resumen</div>
                        <div className="mt-2 text-sm text-gray-700 space-y-1">
                          <div>
                            <b>Entrada:</b> {ticketTitle ? ticketTitle : "—"}
                          </div>
                          <div>
                            <b>Precio:</b> {price ? `$${toCLP(Number(price))}` : "—"}
                          </div>
                          <div>
                            <b>Evento:</b>{" "}
                            {customEvent
                              ? customEventTitle || "Nuevo (por soporte)"
                              : selectedEventId
                              ? "Seleccionado"
                              : "—"}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-8 flex justify-end">
                    <button
                      onClick={() => setStep(2)}
                      disabled={!canGoStep2}
                      className={[
                        "px-6 py-3 rounded-xl font-semibold transition",
                        canGoStep2
                          ? "bg-indigo-600 text-white hover:bg-indigo-700"
                          : "bg-gray-200 text-gray-500 cursor-not-allowed",
                      ].join(" ")}
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
                <div className="rounded-2xl border border-gray-200 p-6">
                  <h2 className="text-2xl font-extrabold text-gray-900">Subir archivo</h2>
                  <p className="mt-2 text-gray-600">
                    Sube tu <b>PDF</b> (entrada). Solo PDF.
                  </p>

                  <div className="mt-6">
                    <div className="rounded-2xl border-2 border-dashed border-gray-300 p-8 text-center">
                      <div className="text-gray-700 font-semibold">Arrastra tu PDF acá o selecciónalo</div>
                      <div className="mt-3 flex justify-center">
                        <label className="inline-flex items-center gap-2 cursor-pointer px-5 py-3 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700">
                          <span>Elegir PDF</span>
                          <input
                            type="file"
                            accept="application/pdf,.pdf"
                            className="hidden"
                            onChange={(e) => onPickPdf(e.target.files?.[0] ?? null)}
                          />
                        </label>
                      </div>

                      {pdfFile ? (
                        <div className="mt-4 text-sm text-gray-700">
                          <b>Archivo:</b> {pdfFile.name} • {(pdfFile.size / 1024 / 1024).toFixed(2)} MB
                          <div className="mt-2">
                            <button
                              className="text-xs text-red-600 underline"
                              onClick={() => {
                                setPdfFile(null);
                                setPdfError(null);
                              }}
                            >
                              Quitar archivo
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-4 text-sm text-gray-500">Aún no has subido un archivo.</div>
                      )}

                      {pdfError ? <div className="mt-3 text-sm text-red-600">{pdfError}</div> : null}
                    </div>
                  </div>

                  <div className="mt-8 flex items-center justify-between">
                    <button
                      onClick={() => setStep(1)}
                      className="px-6 py-3 rounded-xl font-semibold border border-gray-300 hover:bg-gray-50"
                    >
                      Volver
                    </button>

                    <button
                      onClick={() => setStep(3)}
                      disabled={!canGoStep3}
                      className={[
                        "px-6 py-3 rounded-xl font-semibold transition",
                        canGoStep3
                          ? "bg-indigo-600 text-white hover:bg-indigo-700"
                          : "bg-gray-200 text-gray-500 cursor-not-allowed",
                      ].join(" ")}
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
                <div className="rounded-2xl border border-gray-200 p-6">
                  <h2 className="text-2xl font-extrabold text-gray-900">Confirmar</h2>
                  <p className="mt-2 text-gray-600">
                    Revisa que todo esté ok. Al publicar, subiremos tu PDF y se creará la publicación (o solicitud a soporte).
                  </p>

                  <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="rounded-xl border border-gray-200 p-4">
                      <div className="text-sm font-semibold text-gray-900">Evento</div>
                      <div className="mt-2 text-sm text-gray-700">
                        {customEvent ? (
                          <>
                            <div><b>Nuevo:</b> {customEventTitle || "—"}</div>
                            <div><b>Fecha:</b> {customEventDate || "—"}</div>
                            <div><b>Lugar:</b> {customEventVenue || "—"}</div>
                          </>
                        ) : (
                          <div>{selectedEventId ? "Evento seleccionado ✅" : "—"}</div>
                        )}
                      </div>
                    </div>

                    <div className="rounded-xl border border-gray-200 p-4">
                      <div className="text-sm font-semibold text-gray-900">Entrada</div>
                      <div className="mt-2 text-sm text-gray-700 space-y-1">
                        <div><b>Título:</b> {ticketTitle || "—"}</div>
                        <div><b>Precio:</b> {price ? `$${toCLP(Number(price))}` : "—"}</div>
                        {originalPrice ? <div><b>Precio original:</b> ${toCLP(Number(originalPrice))}</div> : null}
                        {sector ? <div><b>Sector:</b> {sector}</div> : null}
                        {row ? <div><b>Fila:</b> {row}</div> : null}
                        {seat ? <div><b>Asiento:</b> {seat}</div> : null}
                        {description ? <div><b>Descripción:</b> {description}</div> : null}
                      </div>
                    </div>

                    <div className="md:col-span-2 rounded-xl border border-gray-200 p-4 bg-gray-50">
                      <div className="text-sm font-semibold text-gray-900">Archivo</div>
                      <div className="mt-2 text-sm text-gray-700">
                        {pdfFile ? (
                          <>
                            <div><b>PDF:</b> {pdfFile.name}</div>
                            <div className="text-xs text-gray-500">El archivo se sube al publicar.</div>
                          </>
                        ) : (
                          <div>—</div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mt-8 flex items-center justify-between">
                    <button
                      onClick={() => setStep(2)}
                      className="px-6 py-3 rounded-xl font-semibold border border-gray-300 hover:bg-gray-50"
                    >
                      Volver
                    </button>

                    <button
                      onClick={onSubmitFinal}
                      disabled={submitting}
                      className={[
                        "px-6 py-3 rounded-xl font-semibold transition",
                        submitting ? "bg-gray-200 text-gray-500 cursor-not-allowed" : "bg-indigo-600 text-white hover:bg-indigo-700",
                      ].join(" ")}
                    >
                      {customEvent ? (submitting ? "Enviando..." : "Enviar a soporte") : submitting ? "Publicando..." : "Publicar entrada"}
                    </button>
                  </div>
                </div>

                <div className="text-xs text-gray-500">
                  Tip: si en algún momento te aparece “column events.date does not exist”, es porque en tu BD el campo se llama <b>starts_at</b>.
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
