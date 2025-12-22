"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabaseClient"; // ✅ FIX: named export (no default)

type EventItem = {
  id: string | number;
  title: string;
  venue?: string | null;
  city?: string | null;
  country?: string | null;
  starts_at?: string | null;
};

type FormState = {
  selectedEvent: EventItem | null;
  search: string;
  description: string;
  sector: string;
  row: string;
  seat: string;
  salePrice: string;
  originalPrice: string;
  saleType: "fixed" | "auction";
};

export default function SellPage() {
  const router = useRouter();

  const [events, setEvents] = useState<EventItem[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);

  const [openList, setOpenList] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const [state, setState] = useState<FormState>({
    selectedEvent: null,
    search: "",
    description: "",
    sector: "",
    row: "",
    seat: "",
    salePrice: "",
    originalPrice: "",
    saleType: "fixed",
  });

  // ---------- Fetch eventos ----------
  useEffect(() => {
    let mounted = true;

    async function loadEvents() {
      setLoadingEvents(true);
      try {
        const { data, error } = await supabase
          .from("events")
          .select("id,title,venue,city,country,starts_at")
          .order("starts_at", { ascending: true });

        if (error) throw error;

        if (mounted) setEvents((data as EventItem[]) ?? []);
      } catch {
        // fallback (por si hay env vars o tabla)
        if (mounted) {
          setEvents([
            {
              id: "demo-1",
              title: "My Chemical Romance",
              venue: "Estadio Bicentenario de La Florida",
              city: "Santiago",
              country: "Chile",
              starts_at: "2026-01-29T21:00:00Z",
            },
            {
              id: "demo-2",
              title: "Chayanne",
              venue: "Estadio Nacional",
              city: "Santiago",
              country: "Chile",
              starts_at: "2026-02-11T21:00:00Z",
            },
          ]);
        }
      } finally {
        if (mounted) setLoadingEvents(false);
      }
    }

    loadEvents();
    return () => {
      mounted = false;
    };
  }, []);

  // ---------- Close dropdown on outside click ----------
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (!listRef.current) return;
      if (!listRef.current.contains(target)) setOpenList(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  // ---------- Filtrado ----------
  const filteredEvents = useMemo(() => {
    const q = state.search.trim().toLowerCase();
    if (!q) return events;

    return events.filter((ev) => {
      const hay = `${ev.title} ${ev.venue ?? ""} ${ev.city ?? ""} ${ev.country ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [events, state.search]);

  // ---------- Helpers ----------
  function fmtDate(iso?: string | null) {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleString("es-CL", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) {
    const { name, value } = e.target;
    setState((prev) => ({ ...prev, [name]: value }));
  }

  function selectEvent(ev: EventItem) {
    setState((prev) => ({
      ...prev,
      selectedEvent: ev,
      search: ev.title,
    }));
    setOpenList(false);
  }

  const canContinue =
    !!state.selectedEvent &&
    state.description.trim().length >= 3 &&
    Number(state.salePrice) > 0;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canContinue) return;

    setIsSubmitting(true);
    try {
      // Acá después conectamos al paso 2 (PDF) y guardado real.
      // Por ahora solo demo:
      // console.log("FORM", state);
      router.push("/sell?step=2");
    } finally {
      setIsSubmitting(false);
    }
  }

  const inputBase =
    "w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm " +
    "placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100";

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="mx-auto w-full max-w-5xl px-4 py-10">
        {/* Shell Card */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {/* Header (como tu imagen 1) */}
          <div className="bg-gradient-to-r from-blue-500 to-purple-600 px-8 py-8">
            <h1 className="text-3xl font-extrabold tracking-tight text-white">
              Vender entrada
            </h1>

            {/* Stepper */}
            <div className="mt-6 flex items-center gap-4">
              <StepPill label="Detalles" step={1} activeStep={1} />
              <div className="h-[2px] flex-1 rounded bg-white/30" />
              <StepPill label="Archivo" step={2} activeStep={1} />
              <div className="h-[2px] flex-1 rounded bg-white/30" />
              <StepPill label="Confirmar" step={3} activeStep={1} />
            </div>
          </div>

          {/* Body */}
          <div className="px-8 py-8">
            <h2 className="text-2xl font-bold text-slate-900">
              Detalles de la entrada
            </h2>

            <form onSubmit={onSubmit} className="mt-6 space-y-6">
              {/* Evento */}
              <div className="space-y-2" ref={listRef}>
                <label className="block text-sm font-semibold text-slate-800">
                  Evento <span className="text-blue-600">*</span>
                </label>
                <p className="text-xs text-slate-500">
                  Haz click para desplegar. Escribe para filtrar y selecciona.
                </p>

                <div className="relative">
                  <input
                    type="text"
                    name="search"
                    value={state.search}
                    onChange={(e) =>
                      setState((prev) => ({
                        ...prev,
                        search: e.target.value,
                        selectedEvent: null,
                      }))
                    }
                    onFocus={() => setOpenList(true)}
                    placeholder="Busca eventos, artistas, lugares..."
                    className={inputBase + " pr-11"}
                    autoComplete="off"
                  />

                  {/* chevron */}
                  <button
                    type="button"
                    onClick={() => setOpenList((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-2 text-slate-500 hover:bg-slate-50"
                    aria-label="Abrir lista de eventos"
                  >
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      className={`transition ${openList ? "rotate-180" : ""}`}
                    >
                      <path
                        d="M6 9l6 6 6-6"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                </div>

                {openList && (
                  <div className="mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                    <div className="max-h-72 overflow-auto">
                      {loadingEvents ? (
                        <div className="px-4 py-3 text-sm text-slate-500">
                          Cargando eventos...
                        </div>
                      ) : filteredEvents.length === 0 ? (
                        <div className="px-4 py-3 text-sm text-slate-500">
                          No encontramos eventos con ese texto.
                        </div>
                      ) : (
                        filteredEvents.map((ev) => (
                          <button
                            key={String(ev.id)}
                            type="button"
                            onClick={() => selectEvent(ev)}
                            className="w-full px-4 py-3 text-left transition hover:bg-slate-50"
                          >
                            <p className="text-sm font-semibold text-slate-900">
                              {ev.title}
                            </p>
                            <p className="text-xs text-slate-500">
                              {(ev.venue ? ev.venue : "—")}
                              {ev.city ? ` — ${ev.city}` : ""}
                              {ev.country ? `, ${ev.country}` : ""}
                              {ev.starts_at ? ` • ${fmtDate(ev.starts_at)}` : ""}
                            </p>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* ✅ Cambio UX: Solo Descripción (sin Título) */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-800">
                  Descripción <span className="text-blue-600">*</span>
                </label>
                <textarea
                  name="description"
                  value={state.description}
                  onChange={handleChange}
                  placeholder="Ej: Entrada General - Platea Alta. Indica ubicación exacta, estado, restricciones, etc."
                  className={inputBase + " min-h-[120px] resize-y"}
                  required
                />
                <p className="text-xs text-slate-500">
                  Tip: con “Sector / Fila / Asiento + estado” ya está perfecto.
                </p>
              </div>

              {/* Ubicación */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-slate-800">
                    Sector
                  </label>
                  <input
                    type="text"
                    name="sector"
                    value={state.sector}
                    onChange={handleChange}
                    placeholder="Campo, Platea, etc."
                    className={inputBase}
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-slate-800">
                    Fila
                  </label>
                  <input
                    type="text"
                    name="row"
                    value={state.row}
                    onChange={handleChange}
                    placeholder="A, B, 1, 2, etc."
                    className={inputBase}
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-slate-800">
                    Asiento
                  </label>
                  <input
                    type="text"
                    name="seat"
                    value={state.seat}
                    onChange={handleChange}
                    placeholder="1, 2, 3, etc."
                    className={inputBase}
                  />
                </div>
              </div>

              {/* Precios */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-slate-800">
                    Precio de venta <span className="text-blue-600">*</span>
                  </label>
                  <input
                    type="number"
                    min={0}
                    name="salePrice"
                    value={state.salePrice}
                    onChange={handleChange}
                    placeholder="50000"
                    className={inputBase}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-slate-800">
                    Precio original (opcional)
                  </label>
                  <input
                    type="number"
                    min={0}
                    name="originalPrice"
                    value={state.originalPrice}
                    onChange={handleChange}
                    placeholder="60000"
                    className={inputBase}
                  />
                </div>
              </div>

              {/* Tipo de venta */}
              <div className="space-y-3">
                <label className="block text-sm font-semibold text-slate-800">
                  Tipo de venta
                </label>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <button
                    type="button"
                    onClick={() =>
                      setState((prev) => ({ ...prev, saleType: "fixed" }))
                    }
                    className={`flex flex-col items-start rounded-xl border px-4 py-4 text-left text-sm shadow-sm transition ${
                      state.saleType === "fixed"
                        ? "border-blue-500 bg-blue-50 ring-4 ring-blue-100"
                        : "border-slate-200 bg-white hover:bg-slate-50"
                    }`}
                  >
                    <span className="flex items-center gap-2 font-semibold text-slate-900">
                      <span className="text-green-600">$</span> Precio fijo
                    </span>
                    <span className="mt-1 text-xs text-slate-500">
                      Vende inmediatamente al precio que estableciste
                    </span>
                  </button>

                  <button
                    type="button"
                    disabled
                    className="flex flex-col items-start rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-left text-sm shadow-sm opacity-70 cursor-not-allowed"
                  >
                    <span className="flex items-center gap-2 font-semibold text-slate-900">
                      <span className="text-orange-500">⏱</span> Subasta{" "}
                      <span className="text-xs font-semibold text-slate-500">
                        (próximamente)
                      </span>
                    </span>
                    <span className="mt-1 text-xs text-slate-500">
                      Deja que los compradores pujen por tu entrada
                    </span>
                  </button>
                </div>
              </div>

              {/* Acciones */}
              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => router.back()}
                  className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={!canContinue || isSubmitting}
                  className="rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60 disabled:hover:bg-blue-600"
                >
                  {isSubmitting ? "Guardando..." : "Continuar"}
                </button>
              </div>

              <div className="pt-2 text-center text-xs text-slate-400">
                {events.length} eventos cargados.
              </div>
            </form>
          </div>
        </div>
      </div>
    </main>
  );
}

function StepPill({
  label,
  step,
  activeStep,
}: {
  label: string;
  step: number;
  activeStep: number;
}) {
  const isActive = step === activeStep;
  const isCompleted = step < activeStep;

  return (
    <div className="flex items-center gap-3">
      <div
        className={[
          "flex h-8 w-8 items-center justify-center rounded-full text-sm font-extrabold",
          isActive
            ? "bg-white text-blue-600"
            : isCompleted
            ? "bg-white/80 text-emerald-700"
            : "bg-white/25 text-white",
        ].join(" ")}
      >
        {step}
      </div>
      <div
        className={[
          "text-sm font-semibold",
          isActive ? "text-white" : "text-white/80",
        ].join(" ")}
      >
        {label}
      </div>
    </div>
  );
}
