"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { EVENTS } from "../lib/events";

/** Ajusta este tipo si tu objeto cambia */
type EventItem = {
  id: string;
  title: string;
  date?: string;
  dateISO?: string;
  location?: string;
  category?: string;
};

type Step = 1 | 2 | 3;

export default function SellPage() {
  const router = useRouter();

  // ===== Wizard =====
  const [step, setStep] = useState<Step>(1);

  // ===== Events (por ahora: misma data que la home) =====
  const events: EventItem[] = (EVENTS as unknown as EventItem[]) ?? [];

  // ===== Combobox (buscador + lista filtrable) =====
  const [eventQuery, setEventQuery] = useState("");
  const [isEventOpen, setIsEventOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<EventItem | null>(null);

  // ===== "Mi evento no está en el listado" =====
  const [requestNewEvent, setRequestNewEvent] = useState(false);
  const [requestedEventName, setRequestedEventName] = useState("");

  // ===== Form fields =====
  const [ticketTitle, setTicketTitle] = useState("");
  const [description, setDescription] = useState("");
  const [sector, setSector] = useState("");
  const [fila, setFila] = useState("");
  const [asiento, setAsiento] = useState("");

  const [priceSale, setPriceSale] = useState<string>(""); // requerido
  const [priceOriginal, setPriceOriginal] = useState<string>(""); // opcional

  // Venta (por ahora solo precio fijo, subasta disabled)
  const [saleType, setSaleType] = useState<"fixed" | "auction">("fixed");

  // ===== PDF =====
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfError, setPdfError] = useState<string>("");

  // ===== Dropdown close on outside click =====
  const comboRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      if (!comboRef.current) return;
      if (!comboRef.current.contains(e.target as Node)) {
        setIsEventOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, []);

  const filteredEvents = useMemo(() => {
    const q = eventQuery.trim().toLowerCase();
    if (!q) return events.slice(0, 30);
    return events
      .filter((ev) => {
        const hay = `${ev.title ?? ""} ${ev.location ?? ""} ${ev.category ?? ""}`.toLowerCase();
        return hay.includes(q);
      })
      .slice(0, 30);
  }, [eventQuery, events]);

  // ===== Validaciones para avanzar =====
  const detailsReady = useMemo(() => {
    const hasEvent = requestNewEvent ? requestedEventName.trim().length >= 3 : !!selectedEvent?.id;
    const hasTitle = ticketTitle.trim().length >= 3;
    const sale = parseInt(priceSale || "0", 10);
    const hasPrice = Number.isFinite(sale) && sale > 0;
    return hasEvent && hasTitle && hasPrice && saleType === "fixed";
  }, [requestNewEvent, requestedEventName, selectedEvent, ticketTitle, priceSale, saleType]);

  const pdfReady = !!pdfFile && !pdfError;

  function formatCLP(value: string) {
    const n = parseInt(value || "0", 10);
    if (!Number.isFinite(n) || n <= 0) return value;
    return n.toLocaleString("es-CL");
  }

  function handlePickEvent(ev: EventItem) {
    setSelectedEvent(ev);
    setEventQuery(ev.title || "");
    setIsEventOpen(false);
  }

  function handlePdfChange(file: File | null) {
    setPdfError("");
    setPdfFile(null);

    if (!file) return;

    const nameOk = file.name.toLowerCase().endsWith(".pdf");
    const mimeOk = file.type === "application/pdf" || file.type === "";

    if (!nameOk && !mimeOk) {
      setPdfError("Solo se permite PDF.");
      return;
    }

    // (Opcional) límite de tamaño: 10MB
    const maxBytes = 10 * 1024 * 1024;
    if (file.size > maxBytes) {
      setPdfError("El PDF es muy pesado (máx 10MB).");
      return;
    }

    setPdfFile(file);
  }

  function goNext() {
    if (step === 1) {
      if (!detailsReady) return;
      setStep(2);
      return;
    }
    if (step === 2) {
      if (!pdfReady) return;
      setStep(3);
      return;
    }
  }

  function goBack() {
    if (step === 1) return;
    setStep((prev) => (prev === 3 ? 2 : 1));
  }

  function handlePublish() {
    // Ojo: acá después conectamos supabase + storage + tabla publicaciones.
    // Por ahora solo UI.
    alert("✅ Listo: UI ok. Falta conectar BD + subir PDF + crear publicación.");
  }

  // ===== UI helpers =====
  const steps = [
    { n: 1 as Step, label: "Detalles" },
    { n: 2 as Step, label: "Archivo" },
    { n: 3 as Step, label: "Confirmar" },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-10">
        {/* Título arriba (como el resto del sitio) */}
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold tracking-tight text-slate-900">Vender entrada</h1>
          <p className="mt-3 text-slate-600">
            Publica tu entrada con respaldo. Elige evento, completa detalles y sube tu PDF.
          </p>
        </div>

        {/* Card centrada tipo “mitad de la página” */}
        <div className="mx-auto max-w-4xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          {/* Header degradado + steps (como tu imagen) */}
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-8 py-7">
            <div className="flex items-start justify-between gap-6">
              <div>
                <h2 className="text-3xl font-extrabold tracking-tight text-white">Vender entrada</h2>
                <p className="mt-1 text-white/80">
                  Completa los datos y publica con pago protegido.
                </p>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-between">
              {steps.map((s, idx) => {
                const active = step === s.n;
                const done = step > s.n;
                return (
                  <div key={s.n} className="flex flex-1 items-center">
                    <div
                      className={[
                        "flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold",
                        done ? "bg-white text-blue-700" : "",
                        active ? "bg-white text-blue-700" : "",
                        !active && !done ? "bg-white/20 text-white" : "",
                      ].join(" ")}
                    >
                      {s.n}
                    </div>
                    <div className="ml-3 text-white/90 font-semibold">{s.label}</div>

                    {idx < steps.length - 1 && (
                      <div className="mx-5 h-[2px] flex-1 rounded bg-white/35" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Body */}
          <div className="px-8 py-8">
            {/* STEP 1 */}
            {step === 1 && (
              <div className="space-y-8">
                <div>
                  <h3 className="text-2xl font-bold text-slate-900">Detalles de la entrada</h3>
                  <p className="mt-1 text-slate-600">Completa la info básica para publicar tu ticket.</p>
                </div>

                {/* Evento */}
                <div className="space-y-3">
                  <label className="block text-sm font-semibold text-slate-900">
                    Evento <span className="text-red-500">*</span>
                  </label>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <label className="flex items-start gap-3 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        checked={requestNewEvent}
                        onChange={(e) => {
                          setRequestNewEvent(e.target.checked);
                          // Reseteos para evitar estados raros
                          setSelectedEvent(null);
                          setEventQuery("");
                          setIsEventOpen(false);
                        }}
                      />
                      <div>
                        <div className="font-semibold text-slate-900">Mi evento no está en el listado</div>
                        <div className="text-sm text-slate-600">
                          Dejas la solicitud y Soporte lo crea para completar el evento.
                        </div>
                      </div>
                    </label>
                  </div>

                  {!requestNewEvent ? (
                    <div ref={comboRef} className="relative">
                      <input
                        value={eventQuery}
                        onChange={(e) => {
                          setEventQuery(e.target.value);
                          setIsEventOpen(true);
                        }}
                        onFocus={() => setIsEventOpen(true)}
                        placeholder="Busca eventos, artistas, lugares..."
                        className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 text-base shadow-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                      />

                      {isEventOpen && (
                        <div className="absolute left-0 right-0 z-20 mt-2 max-h-72 overflow-auto rounded-2xl border border-slate-200 bg-white shadow-lg">
                          {filteredEvents.length === 0 ? (
                            <div className="px-5 py-4 text-sm text-slate-600">No encontré eventos.</div>
                          ) : (
                            filteredEvents.map((ev) => (
                              <button
                                key={ev.id}
                                type="button"
                                onClick={() => handlePickEvent(ev)}
                                className="w-full text-left px-5 py-4 hover:bg-slate-50"
                              >
                                <div className="font-semibold text-slate-900">{ev.title}</div>
                                <div className="mt-1 text-sm text-slate-600">
                                  {ev.location ? ev.location : ""} {ev.date ? `• ${ev.date}` : ""}
                                </div>
                              </button>
                            ))
                          )}
                        </div>
                      )}

                      {/* Preview del evento elegido */}
                      {selectedEvent && (
                        <div className="mt-3 rounded-2xl border border-slate-200 bg-white px-5 py-4">
                          <div className="font-semibold text-slate-900">{selectedEvent.title}</div>
                          <div className="mt-1 text-sm text-slate-600">
                            {selectedEvent.location ? selectedEvent.location : ""}{" "}
                            {selectedEvent.date ? `• ${selectedEvent.date}` : ""}
                          </div>
                        </div>
                      )}

                      <div className="mt-2 text-xs text-slate-500">
                        {events.length} eventos cargados.
                      </div>
                    </div>
                  ) : (
                    <input
                      value={requestedEventName}
                      onChange={(e) => setRequestedEventName(e.target.value)}
                      placeholder="Escribe el nombre del evento (ej: Lollapalooza 2026)"
                      className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 text-base shadow-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                    />
                  )}
                </div>

                {/* Título */}
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-slate-900">
                    Título de la entrada <span className="text-red-500">*</span>
                  </label>
                  <input
                    value={ticketTitle}
                    onChange={(e) => setTicketTitle(e.target.value)}
                    placeholder="Ej: Entrada General - Platea Alta"
                    className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 text-base shadow-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  />
                </div>

                {/* Descripción */}
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-slate-900">Descripción</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe tu entrada (ubicación específica, estado, restricciones, etc.)"
                    className="min-h-[110px] w-full resize-none rounded-2xl border border-slate-200 bg-white px-5 py-4 text-base shadow-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  />
                </div>

                {/* Sector / Fila / Asiento */}
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-slate-900">Sector</label>
                    <input
                      value={sector}
                      onChange={(e) => setSector(e.target.value)}
                      placeholder="Campo, Platea, etc."
                      className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 text-base shadow-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-slate-900">Fila</label>
                    <input
                      value={fila}
                      onChange={(e) => setFila(e.target.value)}
                      placeholder="A, B, 1, 2, etc."
                      className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 text-base shadow-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-slate-900">Asiento</label>
                    <input
                      value={asiento}
                      onChange={(e) => setAsiento(e.target.value)}
                      placeholder="1, 2, 3, etc."
                      className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 text-base shadow-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                    />
                  </div>
                </div>

                {/* Precios */}
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-slate-900">
                      Precio de venta <span className="text-red-500">*</span>
                    </label>
                    <input
                      inputMode="numeric"
                      value={priceSale}
                      onChange={(e) => setPriceSale(e.target.value.replace(/[^\d]/g, ""))}
                      placeholder="50000"
                      className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 text-base shadow-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                    />
                    {priceSale && (
                      <div className="text-xs text-slate-500">CLP ${formatCLP(priceSale)}</div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-slate-900">
                      Precio original <span className="text-slate-400">(opcional)</span>
                    </label>
                    <input
                      inputMode="numeric"
                      value={priceOriginal}
                      onChange={(e) => setPriceOriginal(e.target.value.replace(/[^\d]/g, ""))}
                      placeholder="60000"
                      className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 text-base shadow-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                    />
                    {priceOriginal && (
                      <div className="text-xs text-slate-500">CLP ${formatCLP(priceOriginal)}</div>
                    )}
                  </div>
                </div>

                {/* Tipo de venta */}
                <div className="space-y-3">
                  <div className="text-sm font-semibold text-slate-900">Tipo de venta</div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => setSaleType("fixed")}
                      className={[
                        "rounded-2xl border p-5 text-left shadow-sm transition",
                        saleType === "fixed"
                          ? "border-blue-600 bg-blue-50 ring-2 ring-blue-100"
                          : "border-slate-200 bg-white hover:bg-slate-50",
                      ].join(" ")}
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl bg-white border border-slate-200">
                          <span className="text-green-600 font-bold">$</span>
                        </div>
                        <div>
                          <div className="font-bold text-slate-900">Precio fijo</div>
                          <div className="mt-1 text-sm text-slate-600">
                            Vende inmediatamente al precio que estableciste
                          </div>
                        </div>
                      </div>
                    </button>

                    <div className="rounded-2xl border border-slate-200 bg-white p-5 opacity-70">
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl bg-white border border-slate-200">
                          <span className="text-slate-500 font-bold">⏱</span>
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <div className="font-bold text-slate-900">Subasta</div>
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                              Próximamente
                            </span>
                          </div>
                          <div className="mt-1 text-sm text-slate-600">
                            Deja que los compradores pujen por tu entrada
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Acciones Step 1 */}
                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={() => router.push("/")}
                    className="rounded-2xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Cancelar
                  </button>

                  <button
                    type="button"
                    onClick={goNext}
                    disabled={!detailsReady}
                    className={[
                      "rounded-2xl px-7 py-3 text-sm font-semibold text-white transition",
                      detailsReady ? "bg-blue-600 hover:bg-blue-700" : "bg-slate-300 cursor-not-allowed",
                    ].join(" ")}
                  >
                    Continuar
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2 */}
            {step === 2 && (
              <div className="space-y-8">
                <div>
                  <h3 className="text-2xl font-bold text-slate-900">Adjunta tu PDF</h3>
                  <p className="mt-1 text-slate-600">
                    Para seguir, necesitamos el PDF de tu entrada (solo PDF).
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-6">
                  <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center">
                    <svg width="44" height="44" viewBox="0 0 24 24" fill="none" className="mb-3">
                      <path
                        d="M7 18H17M7 14H17M8 2H14L19 7V20C19 21.1046 18.1046 22 17 22H8C6.89543 22 6 21.1046 6 20V4C6 2.89543 6.89543 2 8 2Z"
                        stroke="currentColor"
                        className="text-slate-500"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>

                    <div className="text-sm font-semibold text-slate-900">Arrastra tu PDF aquí</div>
                    <div className="mt-1 text-sm text-slate-600">o selecciónalo desde tu computador</div>

                    <label className="mt-4 inline-flex cursor-pointer items-center rounded-2xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700">
                      Seleccionar PDF
                      <input
                        type="file"
                        accept="application/pdf,.pdf"
                        className="hidden"
                        onChange={(e) => handlePdfChange(e.target.files?.[0] ?? null)}
                      />
                    </label>

                    {pdfError && <div className="mt-3 text-sm font-semibold text-red-600">{pdfError}</div>}

                    {pdfFile && !pdfError && (
                      <div className="mt-4 w-full max-w-xl rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left">
                        <div className="text-sm font-semibold text-slate-900">{pdfFile.name}</div>
                        <div className="text-xs text-slate-600">
                          {(pdfFile.size / (1024 * 1024)).toFixed(2)} MB
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={goBack}
                    className="rounded-2xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Volver
                  </button>

                  <button
                    type="button"
                    onClick={goNext}
                    disabled={!pdfReady}
                    className={[
                      "rounded-2xl px-7 py-3 text-sm font-semibold text-white transition",
                      pdfReady ? "bg-blue-600 hover:bg-blue-700" : "bg-slate-300 cursor-not-allowed",
                    ].join(" ")}
                  >
                    Continuar
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3 */}
            {step === 3 && (
              <div className="space-y-8">
                <div>
                  <h3 className="text-2xl font-bold text-slate-900">Confirmar</h3>
                  <p className="mt-1 text-slate-600">Revisa que todo esté correcto antes de publicar.</p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-6">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <SummaryRow
                      label="Evento"
                      value={
                        requestNewEvent
                          ? requestedEventName || "—"
                          : selectedEvent?.title || "—"
                      }
                    />
                    <SummaryRow label="Precio venta" value={priceSale ? `CLP $${formatCLP(priceSale)}` : "—"} />
                    <SummaryRow label="Título" value={ticketTitle || "—"} />
                    <SummaryRow label="Precio original" value={priceOriginal ? `CLP $${formatCLP(priceOriginal)}` : "—"} />
                    <SummaryRow label="Sector" value={sector || "—"} />
                    <SummaryRow label="Fila" value={fila || "—"} />
                    <SummaryRow label="Asiento" value={asiento || "—"} />
                    <SummaryRow label="Tipo" value="Precio fijo" />
                  </div>

                  <div className="mt-5 rounded-2xl bg-slate-50 p-4">
                    <div className="text-sm font-semibold text-slate-900">PDF adjunto</div>
                    <div className="mt-1 text-sm text-slate-700">{pdfFile?.name || "—"}</div>
                  </div>

                  {description && (
                    <div className="mt-5">
                      <div className="text-sm font-semibold text-slate-900">Descripción</div>
                      <div className="mt-1 text-sm text-slate-700 whitespace-pre-wrap">{description}</div>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={goBack}
                    className="rounded-2xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Volver
                  </button>

                  <button
                    type="button"
                    onClick={handlePublish}
                    className="rounded-2xl bg-blue-600 px-7 py-3 text-sm font-semibold text-white hover:bg-blue-700"
                  >
                    Publicar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* aire abajo */}
        <div className="h-10" />
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
      <div className="text-xs font-semibold text-slate-500">{label}</div>
      <div className="mt-0.5 text-sm font-semibold text-slate-900">{value}</div>
    </div>
  );
}
