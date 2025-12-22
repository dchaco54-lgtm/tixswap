"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabaseClient";

type Step = 1 | 2 | 3;

type UiEvent = {
  id: string;
  title: string;
  startsAt?: string | null;
  venue?: string | null;
  city?: string | null;
  category?: string | null;
  imageUrl?: string | null;
};

function pickFirst<T = any>(obj: any, keys: string[]): T | undefined {
  for (const k of keys) {
    if (obj && obj[k] !== undefined && obj[k] !== null) return obj[k] as T;
  }
  return undefined;
}

function parseMaybeDate(s?: string | null): number {
  if (!s) return Number.POSITIVE_INFINITY;
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : Number.POSITIVE_INFINITY;
}

function formatDateLine(ev: UiEvent) {
  const t = parseMaybeDate(ev.startsAt);
  if (!Number.isFinite(t)) return "";
  const d = new Date(t);
  return d.toLocaleString("es-CL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function Stepper({ step }: { step: Step }) {
  const items: { n: Step; label: string }[] = [
    { n: 1, label: "Detalles" },
    { n: 2, label: "Archivo" },
    { n: 3, label: "Confirmar" },
  ];

  const isDone = (n: Step) => n < step;
  const isActive = (n: Step) => n === step;

  return (
    <div className="mt-5">
      <div className="flex items-center justify-between gap-3">
        {items.map((it, idx) => (
          <React.Fragment key={it.n}>
            <div className="flex items-center gap-3">
              <div
                className={[
                  "grid h-10 w-10 place-items-center rounded-full border text-sm font-semibold",
                  isDone(it.n)
                    ? "border-white/30 bg-white/20 text-white"
                    : isActive(it.n)
                    ? "border-white bg-white text-indigo-700"
                    : "border-white/30 bg-white/10 text-white/90",
                ].join(" ")}
                aria-label={`Paso ${it.n}`}
              >
                {it.n}
              </div>
              <div className="leading-tight">
                <div className="text-sm font-semibold text-white">{it.label}</div>
              </div>
            </div>

            {idx < items.length - 1 && (
              <div className="hidden flex-1 items-center px-2 sm:flex">
                <div
                  className={[
                    "h-1 w-full rounded-full",
                    step > it.n ? "bg-white/70" : "bg-white/20",
                  ].join(" ")}
                />
              </div>
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

/** Selector con búsqueda (1 sola caja) */
function EventCombobox({
  disabled,
  loading,
  events,
  value,
  onChange,
  placeholder = "Busca y selecciona un evento…",
}: {
  disabled?: boolean;
  loading?: boolean;
  events: UiEvent[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selected = useMemo(
    () => events.find((e) => e.id === value) ?? null,
    [events, value]
  );

  useEffect(() => {
    if (selected) setQuery(selected.title);
    if (!selected && !open) setQuery("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return events;
    return events.filter((e) => {
      const hay = `${e.title} ${e.venue ?? ""} ${e.city ?? ""} ${
        e.category ?? ""
      }`.toLowerCase();
      return hay.includes(q);
    });
  }, [events, query]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <div ref={wrapRef} className="relative">
      <input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          if (!open) setOpen(true);
          if (value) onChange("");
        }}
        onFocus={() => setOpen(true)}
        disabled={disabled}
        placeholder={loading ? "Cargando eventos..." : placeholder}
        className={[
          "w-full rounded-xl border px-4 py-3 text-sm outline-none transition",
          disabled
            ? "border-slate-200 bg-slate-50 text-slate-400"
            : "border-slate-200 bg-white text-slate-900 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100",
        ].join(" ")}
      />

      {open && !disabled && (
        <div className="absolute z-20 mt-2 max-h-72 w-full overflow-auto rounded-2xl border border-slate-200 bg-white shadow-lg">
          {loading ? (
            <div className="px-4 py-3 text-sm text-slate-600">Cargando…</div>
          ) : filtered.length === 0 ? (
            <div className="px-4 py-3 text-sm text-slate-600">
              No encontré eventos con ese texto.
            </div>
          ) : (
            filtered.map((ev) => {
              const isSelected = ev.id === value;
              return (
                <button
                  type="button"
                  key={ev.id}
                  onClick={() => {
                    onChange(ev.id);
                    setQuery(ev.title);
                    setOpen(false);
                  }}
                  className={[
                    "w-full px-4 py-3 text-left transition",
                    "hover:bg-slate-50",
                    isSelected ? "bg-indigo-50" : "bg-white",
                  ].join(" ")}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">
                        {ev.title}
                      </div>
                      <div className="mt-1 text-xs text-slate-600">
                        {[ev.venue, ev.city, ev.startsAt ? formatDateLine(ev) : ""]
                          .filter(Boolean)
                          .join(" • ")}
                      </div>
                    </div>
                    {isSelected && (
                      <div className="mt-0.5 rounded-full bg-indigo-600 px-2 py-1 text-[10px] font-semibold text-white">
                        Elegido
                      </div>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

export default function SellPage() {
  const router = useRouter();

  const [events, setEvents] = useState<UiEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [eventsError, setEventsError] = useState<string | null>(null);

  const [selectedEventId, setSelectedEventId] = useState("");

  const [step, setStep] = useState<Step>(1);

  const [createEvent, setCreateEvent] = useState(false);
  const [customEventName, setCustomEventName] = useState("");
  const [customEventDate, setCustomEventDate] = useState("");
  const [customEventVenue, setCustomEventVenue] = useState("");

  const [ticketTitle, setTicketTitle] = useState("");
  const [description, setDescription] = useState("");
  const [sector, setSector] = useState("");
  const [fila, setFila] = useState("");
  const [asiento, setAsiento] = useState("");
  const [priceSale, setPriceSale] = useState<string>("");
  const [priceOriginal, setPriceOriginal] = useState<string>("");

  const [saleType, setSaleType] = useState<"fixed" | "auction">("fixed");
  const [emergencyAuction, setEmergencyAuction] = useState(false);

  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);

  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    (async () => {
      setLoadingEvents(true);
      setEventsError(null);

      try {
        const { data, error } = await supabase.from("events").select("*");
        if (error) throw error;

        const mapped: UiEvent[] = (data ?? []).map((e: any) => {
          const startsAt =
            pickFirst<string>(e, [
              "starts_at",
              "start_at",
              "date",
              "event_date",
              "datetime",
              "start_date",
            ]) ?? null;

          return {
            id: String(pickFirst(e, ["id"]) ?? ""),
            title: String(pickFirst(e, ["title", "name"]) ?? "Evento"),
            startsAt,
            venue: pickFirst<string>(e, ["venue", "location", "place"]) ?? null,
            city: pickFirst<string>(e, ["city", "town"]) ?? null,
            category:
              pickFirst<string>(e, ["category", "genre", "type"]) ?? null,
            imageUrl:
              pickFirst<string>(e, ["image_url", "imageUrl", "img", "cover_url"]) ??
              null,
          };
        });

        mapped.sort((a, b) => parseMaybeDate(a.startsAt) - parseMaybeDate(b.startsAt));

        if (mounted) setEvents(mapped.filter((x) => x.id));
      } catch (err: any) {
        if (mounted) {
          setEvents([]);
          setEventsError(err?.message ?? "No pude cargar los eventos.");
        }
      } finally {
        if (mounted) setLoadingEvents(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const selectedEvent = useMemo(
    () => events.find((e) => e.id === selectedEventId) ?? null,
    [events, selectedEventId]
  );

  function moneyOnly(v: string) {
    return v.replace(/[^\d]/g, "");
  }

  function onPdfChange(file: File | null) {
    setPdfError(null);
    setPdfFile(null);

    if (!file) return;

    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) return setPdfError("El archivo debe ser PDF.");

    const max = 10 * 1024 * 1024;
    if (file.size > max) return setPdfError("El PDF es muy pesado (máx 10MB).");

    setPdfFile(file);
  }

  function validateStep1() {
    setFormError(null);

    if (createEvent) {
      if (!customEventName.trim()) return setFormError("Pon el nombre del evento."), false;
    } else {
      if (!selectedEventId) return setFormError("Selecciona un evento."), false;
    }

    if (!ticketTitle.trim()) return setFormError("Pon un título para tu entrada."), false;
    if (!priceSale.trim() || Number(priceSale) <= 0) return setFormError("Pon un precio de venta válido."), false;

    return true;
  }

  function validateStep2() {
    setFormError(null);
    if (!pdfFile) return setFormError("Adjunta tu PDF para continuar."), false;
    return true;
  }

  function goNext() {
    if (step === 1) {
      if (!validateStep1()) return;
      setStep(2);
      return;
    }
    if (step === 2) {
      if (!validateStep2()) return;
      setStep(3);
      return;
    }
  }

  function goBack() {
    setFormError(null);
    setPdfError(null);
    setStep((s) => (s === 1 ? 1 : ((s - 1) as Step)));
  }

  async function handlePublish() {
    alert("Listo ✨ (publicación pendiente de conectar).");
    router.push("/");
  }

  return (
    <main className="min-h-screen bg-[#f5f7fb]">
      {/* ✅ ESTRUCTURA: NO ocupa toda la web. Card centrado y angosto */}
      <div className="mx-auto max-w-6xl px-4 py-10">
        {/* Card container angosto como la referencia */}
        <div className="mx-auto w-full max-w-3xl">
          {/* Header/título fuera del card (como tu imagen) */}
          <div className="mb-6 text-center sm:text-left">
            <h1 className="text-4xl font-extrabold tracking-tight text-slate-900">
              Vender entrada
            </h1>
            <p className="mt-2 text-base text-slate-600">
              Publica tu entrada con respaldo. Elige evento, completa detalles y sube tu PDF.
            </p>
          </div>

          <div className="overflow-hidden rounded-3xl bg-white shadow-lg ring-1 ring-black/5">
            <div className="bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-600 px-6 py-8 sm:px-10">
              <div className="text-3xl font-extrabold text-white">Vender entrada</div>
              <div className="mt-2 text-sm text-white/85">
                Completa los datos y publica con pago protegido.
              </div>
              <Stepper step={step} />
            </div>

            <div className="px-6 py-8 sm:px-10">
              {(eventsError || formError || pdfError) && (
                <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {formError ?? pdfError ?? eventsError}
                </div>
              )}

              {step === 1 && (
                <div className="space-y-8">
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900">Detalles de la entrada</h2>
                    <p className="mt-1 text-sm text-slate-600">
                      Completa la info básica para publicar tu ticket.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <label className="block text-sm font-semibold text-slate-900">
                      Evento <span className="text-red-500">*</span>
                    </label>

                    <EventCombobox
                      disabled={createEvent}
                      loading={loadingEvents}
                      events={events}
                      value={selectedEventId}
                      onChange={(id) => setSelectedEventId(id)}
                      placeholder="Busca y selecciona un evento…"
                    />

                    <label className="mt-2 flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <input
                        type="checkbox"
                        checked={createEvent}
                        onChange={(e) => {
                          const v = e.target.checked;
                          setCreateEvent(v);
                          setFormError(null);
                          if (v) setSelectedEventId("");
                        }}
                        className="mt-1 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-200"
                      />
                      <div className="text-sm">
                        <div className="font-semibold text-slate-900">Mi evento no está en el listado</div>
                        <div className="text-slate-600">
                          Dejas la solicitud y Soporte lo crea para completar el evento.
                        </div>
                      </div>
                    </label>

                    {createEvent && (
                      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-3">
                        <div className="sm:col-span-2">
                          <label className="block text-xs font-semibold text-slate-700">
                            Nombre del evento <span className="text-red-500">*</span>
                          </label>
                          <input
                            value={customEventName}
                            onChange={(e) => setCustomEventName(e.target.value)}
                            placeholder="Ej: Festival XYZ 2026"
                            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-700">Fecha (opcional)</label>
                          <input
                            value={customEventDate}
                            onChange={(e) => setCustomEventDate(e.target.value)}
                            placeholder="Ej: 10/02/2026"
                            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                          />
                        </div>
                        <div className="sm:col-span-3">
                          <label className="block text-xs font-semibold text-slate-700">Lugar (opcional)</label>
                          <input
                            value={customEventVenue}
                            onChange={(e) => setCustomEventVenue(e.target.value)}
                            placeholder="Ej: Movistar Arena, Santiago"
                            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                          />
                        </div>
                      </div>
                    )}

                    {!createEvent && selectedEvent && (
                      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                        <div className="font-semibold text-slate-900">{selectedEvent.title}</div>
                        <div className="mt-1 text-slate-600">
                          {[selectedEvent.venue, selectedEvent.city, selectedEvent.startsAt ? formatDateLine(selectedEvent) : ""]
                            .filter(Boolean)
                            .join(" • ")}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-slate-900">
                      Título de la entrada <span className="text-red-500">*</span>
                    </label>
                    <input
                      value={ticketTitle}
                      onChange={(e) => setTicketTitle(e.target.value)}
                      placeholder="Ej: Entrada General - Platea Alta"
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-slate-900">Descripción</label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Describe tu entrada (ubicación específica, estado, restricciones, etc.)"
                      rows={4}
                      className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                    />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-2">
                      <label className="block text-sm font-semibold text-slate-900">Sector</label>
                      <input
                        value={sector}
                        onChange={(e) => setSector(e.target.value)}
                        placeholder="Campo, Platea, etc."
                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="block text-sm font-semibold text-slate-900">Fila</label>
                      <input
                        value={fila}
                        onChange={(e) => setFila(e.target.value)}
                        placeholder="A, B, 1, 2, etc."
                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="block text-sm font-semibold text-slate-900">Asiento</label>
                      <input
                        value={asiento}
                        onChange={(e) => setAsiento(e.target.value)}
                        placeholder="1, 2, 3, etc."
                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <label className="block text-sm font-semibold text-slate-900">
                        Precio de venta <span className="text-red-500">*</span>
                      </label>
                      <input
                        value={priceSale}
                        onChange={(e) => setPriceSale(moneyOnly(e.target.value))}
                        placeholder="50000"
                        inputMode="numeric"
                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="block text-sm font-semibold text-slate-900">
                        Precio original (opcional)
                      </label>
                      <input
                        value={priceOriginal}
                        onChange={(e) => setPriceOriginal(moneyOnly(e.target.value))}
                        placeholder="60000"
                        inputMode="numeric"
                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="text-sm font-semibold text-slate-900">Tipo de venta</div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <button
                        type="button"
                        onClick={() => setSaleType("fixed")}
                        className={[
                          "group rounded-2xl border p-4 text-left transition",
                          saleType === "fixed"
                            ? "border-indigo-500 bg-indigo-50 ring-4 ring-indigo-100"
                            : "border-slate-200 bg-white hover:border-slate-300",
                        ].join(" ")}
                      >
                        <div className="flex items-start gap-3">
                          <div className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-100 text-emerald-700">
                            $
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900">Precio fijo</div>
                            <div className="mt-1 text-sm text-slate-600">
                              Vende inmediatamente al precio que estableciste
                            </div>
                          </div>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSaleType("auction")}
                        className={[
                          "relative group rounded-2xl border p-4 text-left transition",
                          saleType === "auction"
                            ? "border-indigo-500 bg-indigo-50 ring-4 ring-indigo-100"
                            : "border-slate-200 bg-white hover:border-slate-300",
                        ].join(" ")}
                      >
                        <div className="flex items-start gap-3">
                          <div className="grid h-9 w-9 place-items-center rounded-xl bg-orange-100 text-orange-700">
                            ⏱
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <div className="font-semibold text-slate-900">Subasta</div>
                              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                                Próximamente
                              </span>
                            </div>
                            <div className="mt-1 text-sm text-slate-600">
                              Deja que los compradores pujen por tu entrada
                            </div>
                          </div>
                        </div>
                      </button>
                    </div>

                    <label className="flex items-start gap-3 rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3">
                      <input
                        type="checkbox"
                        checked={emergencyAuction}
                        onChange={(e) => setEmergencyAuction(e.target.checked)}
                        className="mt-1 h-4 w-4 rounded border-orange-300 text-orange-600 focus:ring-orange-200"
                      />
                      <div className="text-sm">
                        <div className="font-semibold text-orange-800">
                          Subasta automática de emergencia
                        </div>
                        <div className="text-orange-700">
                          Si tu entrada no se vende, se activa una subasta 2 horas antes del evento. (lo dejamos para después)
                        </div>
                      </div>
                    </label>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <button
                      type="button"
                      onClick={() => router.push("/")}
                      className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:border-slate-300"
                    >
                      Cancelar
                    </button>

                    <button
                      type="button"
                      onClick={goNext}
                      className="rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
                    >
                      Continuar
                    </button>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-8">
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900">Archivo</h2>
                    <p className="mt-1 text-sm text-slate-600">
                      Adjunta tu ticket en PDF. (Validamos que sea PDF)
                    </p>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-6">
                    <label className="block text-sm font-semibold text-slate-900">
                      PDF del ticket <span className="text-red-500">*</span>
                    </label>
                    <p className="mt-1 text-sm text-slate-600">
                      Asegúrate de que el PDF sea legible y corresponda al evento.
                    </p>

                    <div className="mt-4">
                      <input
                        type="file"
                        accept="application/pdf,.pdf"
                        onChange={(e) => onPdfChange(e.target.files?.[0] ?? null)}
                        className="block w-full text-sm file:mr-4 file:rounded-xl file:border-0 file:bg-indigo-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-indigo-700 hover:file:bg-indigo-100"
                      />
                      {pdfFile && (
                        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                          <div className="font-semibold text-slate-900">Archivo seleccionado</div>
                          <div className="mt-1">
                            {pdfFile.name} • {(pdfFile.size / 1024 / 1024).toFixed(2)} MB
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <button
                      type="button"
                      onClick={goBack}
                      className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:border-slate-300"
                    >
                      Volver
                    </button>

                    <button
                      type="button"
                      onClick={goNext}
                      className="rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
                    >
                      Continuar
                    </button>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-8">
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900">Confirmar</h2>
                    <p className="mt-1 text-sm text-slate-600">
                      Revisa los datos antes de publicar.
                    </p>
                  </div>

                  <div className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-6 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Evento
                      </div>
                      <div className="mt-1 text-lg font-bold text-slate-900">
                        {createEvent ? customEventName : selectedEvent?.title ?? "—"}
                      </div>
                      <div className="mt-1 text-sm text-slate-600">
                        {createEvent
                          ? [customEventVenue, customEventDate].filter(Boolean).join(" • ")
                          : [
                              selectedEvent?.venue,
                              selectedEvent?.city,
                              selectedEvent?.startsAt ? formatDateLine(selectedEvent) : "",
                            ]
                              .filter(Boolean)
                              .join(" • ")}
                      </div>
                    </div>

                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Título
                      </div>
                      <div className="mt-1 font-semibold text-slate-900">{ticketTitle}</div>
                    </div>

                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Precio de venta
                      </div>
                      <div className="mt-1 font-semibold text-slate-900">
                        ${Number(priceSale || "0").toLocaleString("es-CL")}
                      </div>
                    </div>

                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Ubicación
                      </div>
                      <div className="mt-1 text-sm text-slate-700">
                        {[sector, fila && `Fila ${fila}`, asiento && `Asiento ${asiento}`]
                          .filter(Boolean)
                          .join(" • ") || "—"}
                      </div>
                    </div>

                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Tipo de venta
                      </div>
                      <div className="mt-1 text-sm font-semibold text-slate-900">
                        {saleType === "fixed" ? "Precio fijo" : "Subasta"}
                      </div>
                    </div>

                    <div className="sm:col-span-2">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        PDF
                      </div>
                      <div className="mt-1 text-sm text-slate-700">{pdfFile ? pdfFile.name : "—"}</div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <button
                      type="button"
                      onClick={goBack}
                      className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:border-slate-300"
                    >
                      Volver
                    </button>

                    <button
                      type="button"
                      onClick={handlePublish}
                      className="rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
                    >
                      Publicar
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="mt-6 text-center text-xs text-slate-400 sm:text-left">
            {loadingEvents ? "Cargando eventos..." : `${events.length} eventos cargados.`}
          </div>
        </div>
      </div>
    </main>
  );
}
