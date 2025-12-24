"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

const DRAFT_KEY = "tixswap_sell_draft_v1";

function normalizeEventRow(e) {
  return {
    id: e.id ?? e.event_id ?? e.uuid ?? e.slug ?? String(Math.random()),
    title: e.title ?? e.name ?? e.event_name ?? e.nombre ?? "Evento sin nombre",
    starts_at: e.starts_at ?? e.start_at ?? e.date ?? e.start_date ?? e.fecha ?? null,
    venue: e.venue ?? e.place ?? e.location ?? e.venue_name ?? e.lugar ?? null,
    city: e.city ?? e.ciudad ?? null,
  };
}

function formatEventDate(starts_at) {
  if (!starts_at) return "";
  const d = new Date(starts_at);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" });
}

export default function SellConfirmPage() {
  const router = useRouter();

  const [draft, setDraft] = useState(null);

  // eventos para poder “cambiarlo si se equivocó”
  const [events, setEvents] = useState([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [eventQuery, setEventQuery] = useState("");
  const [eventOpen, setEventOpen] = useState(false);
  const dropdownRef = useRef(null);

  const [selectedEvent, setSelectedEvent] = useState(null);

  // precio editable
  const [price, setPrice] = useState("");
  const [originalPrice, setOriginalPrice] = useState("");

  // tipo venta (por ahora fijo)
  const [saleType] = useState("fixed");

  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState("");

  // cerrar dropdown al click afuera
  useEffect(() => {
    function onDocClick(e) {
      if (!dropdownRef.current) return;
      if (!dropdownRef.current.contains(e.target)) setEventOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  // cargar draft y validar que venga paso 2 listo
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) {
        router.replace("/sell");
        return;
      }
      const parsed = JSON.parse(raw);

      // si no hay evento o no hay pdf “validado”, lo mando al paso correcto
      if (!parsed?.event_id) {
        router.replace("/sell");
        return;
      }
      if (!parsed?.ticketUpload?.uploaded) {
        router.replace("/sell/file");
        return;
      }

      setDraft(parsed);
      setPrice(String(parsed?.price ?? ""));
      setOriginalPrice(parsed?.originalPrice ? String(parsed.originalPrice) : "");
      setEventQuery(parsed?.event_title || "");
    } catch {
      router.replace("/sell");
    }
  }, [router]);

  // cargar eventos (para cambiarlo)
  useEffect(() => {
    let alive = true;

    async function loadEvents() {
      setEventsLoading(true);
      const { data, error } = await supabase.from("events").select("*").limit(300);

      if (!alive) return;

      if (error) {
        setEvents([]);
        setEventsLoading(false);
        return;
      }

      const normalized = (data || []).map(normalizeEventRow);
      normalized.sort((a, b) => {
        const ta = a.starts_at ? new Date(a.starts_at).getTime() : 0;
        const tb = b.starts_at ? new Date(b.starts_at).getTime() : 0;
        return ta - tb;
      });

      setEvents(normalized);
      setEventsLoading(false);

      // set selectedEvent inicial desde draft
      const found = normalized.find((x) => String(x.id) === String(draft?.event_id));
      if (found) setSelectedEvent(found);
      else if (draft?.event_id) setSelectedEvent({ id: draft.event_id, title: draft.event_title || "Evento" });
    }

    loadEvents();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft?.event_id]);

  const filteredEvents = useMemo(() => {
    const q = (eventQuery || "").trim().toLowerCase();
    if (!q) return events;

    return events.filter((ev) => {
      const hay = `${ev.title ?? ""} ${ev.venue ?? ""} ${ev.city ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [events, eventQuery]);

  function selectEvent(ev) {
    setSelectedEvent(ev);
    setEventQuery(ev.title ?? "");
    setEventOpen(false);

    // actualizar draft altiro
    const nextDraft = {
      ...(draft || {}),
      event_id: ev.id,
      event_title: ev.title || null,
    };
    setDraft(nextDraft);
    localStorage.setItem(DRAFT_KEY, JSON.stringify(nextDraft));
  }

  const canPublish = useMemo(() => {
    const p = Number(String(price).replace(/[^\d]/g, ""));
    return !!selectedEvent?.id && Number.isFinite(p) && p > 0 && !publishing;
  }, [selectedEvent?.id, price, publishing]);

  async function handlePublish() {
    setError("");
    if (!draft) return;
    if (!canPublish) return;

    setPublishing(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) {
        router.replace(`/login?redirectTo=${encodeURIComponent("/sell/confirm")}`);
        return;
      }

      const payload = {
        event_id: selectedEvent?.id,
        price: Number(String(price).replace(/[^\d]/g, "")),
        originalPrice: originalPrice ? Number(String(originalPrice).replace(/[^\d]/g, "")) : null,
        saleType: saleType || "fixed",

        // paso 1
        description: draft?.description || null,
        sector: draft?.sector || null,
        fila: draft?.fila || null,
        asiento: draft?.asiento || null,

        // paso 2 (pdf)
        ticketUpload: draft?.ticketUpload || null,
      };

      const res = await fetch("/api/tickets/publish", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data?.details ? `${data.error}: ${data.details}` : (data?.error || "No se pudo publicar."));
        return;
      }

      // limpiar draft y mandar al evento
      localStorage.removeItem(DRAFT_KEY);
      router.push(`/events/${data?.event_id || selectedEvent.id}`);
    } catch (e) {
      setError(e?.message || "No se pudo publicar.");
    } finally {
      setPublishing(false);
    }
  }

  function handleBack() {
    router.push("/sell/file");
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-5xl px-4 py-10">
        <div className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
          {/* Stepper (mismo estilo que /sell/file) */}
          <div className="rounded-2xl bg-gradient-to-r from-blue-500 to-purple-500 px-6 py-6 text-white">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3 opacity-80">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 font-semibold">1</div>
                <div className="font-semibold">Detalles</div>
              </div>
              <div className="h-[2px] flex-1 bg-white/30" />
              <div className="flex items-center gap-3 opacity-80">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 font-semibold">2</div>
                <div className="font-semibold">Archivo</div>
              </div>
              <div className="h-[2px] flex-1 bg-white/30" />
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white font-semibold text-slate-900">
                  3
                </div>
                <div className="font-semibold">Confirmar</div>
              </div>
            </div>
          </div>

          <div className="mt-8">
            <h1 className="text-3xl font-bold text-slate-900">Confirmar publicación</h1>
            <p className="mt-2 text-slate-600">
              Revisa el evento, ajusta el precio y publica tu entrada.
            </p>

            {/* Evento (editable) */}
            <div className="mt-8">
              <label className="text-sm font-medium text-slate-700">Evento asociado</label>

              <div className="relative mt-2" ref={dropdownRef}>
                <input
                  className="tix-input w-full"
                  value={eventQuery}
                  onChange={(e) => {
                    setEventQuery(e.target.value);
                    setEventOpen(true);
                  }}
                  onFocus={() => setEventOpen(true)}
                  placeholder={eventsLoading ? "Cargando eventos..." : "Busca y selecciona un evento"}
                  disabled={eventsLoading}
                />

                {eventOpen && !eventsLoading ? (
                  <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg">
                    <div className="max-h-72 overflow-auto">
                      {filteredEvents.length === 0 ? (
                        <div className="px-4 py-3 text-sm text-slate-600">No hay resultados.</div>
                      ) : (
                        filteredEvents.slice(0, 80).map((ev) => (
                          <button
                            key={String(ev.id)}
                            type="button"
                            className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-slate-50"
                            onClick={() => selectEvent(ev)}
                          >
                            <div className="min-w-0">
                              <div className="truncate font-semibold text-slate-900">{ev.title}</div>
                              <div className="mt-0.5 text-xs text-slate-500">
                                {formatEventDate(ev.starts_at)} {ev.venue ? `• ${ev.venue}` : ""} {ev.city ? `• ${ev.city}` : ""}
                              </div>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                ) : null}
              </div>

              {selectedEvent?.id ? (
                <div className="mt-2 text-xs text-slate-500">
                  Seleccionado: <span className="font-semibold text-slate-700">{selectedEvent.title}</span>
                </div>
              ) : null}
            </div>

            {/* Precio (editable) */}
            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="text-sm font-medium text-slate-700">
                  Precio de venta <span className="text-red-500">*</span>
                </label>
                <input
                  className="tix-input mt-2"
                  inputMode="numeric"
                  value={price}
                  onChange={(e) => setPrice(e.target.value.replace(/[^\d]/g, ""))}
                />
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700">Precio original (opcional)</label>
                <input
                  className="tix-input mt-2"
                  inputMode="numeric"
                  value={originalPrice}
                  onChange={(e) => setOriginalPrice(e.target.value.replace(/[^\d]/g, ""))}
                />
              </div>
            </div>

            {/* Tipo de venta (subasta deshabilitada igual que paso 1) */}
            <div className="mt-8">
              <div className="text-sm font-medium text-slate-700">Tipo de venta</div>

              <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-blue-500 bg-blue-50 p-5 ring-4 ring-blue-100">
                  <div className="font-semibold text-slate-900">Precio fijo</div>
                  <div className="mt-1 text-sm text-slate-600">Vende inmediatamente al precio que estableciste</div>
                </div>

                <div className="cursor-not-allowed rounded-2xl border border-slate-200 bg-slate-50 p-5">
                  <div className="flex items-center gap-2 font-semibold text-slate-900">
                    Subasta
                    <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-700">
                      Se viene pronto
                    </span>
                  </div>
                  <div className="mt-1 text-sm text-slate-600">
                    Podrás elegir entre dos tipos de subasta (próximamente).
                  </div>
                </div>
              </div>
            </div>

            {/* Acciones */}
            <div className="mt-10 flex items-center justify-between">
              <button type="button" className="tix-btn-secondary" onClick={handleBack} disabled={publishing}>
                Volver
              </button>

              <button
                type="button"
                className="tix-btn-primary"
                onClick={handlePublish}
                disabled={!canPublish}
                title={!canPublish ? "Revisa evento + precio" : ""}
              >
                {publishing ? "Publicando..." : "Publicar"}
              </button>
            </div>

            {error ? (
              <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
