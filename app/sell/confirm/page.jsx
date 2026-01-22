"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { calculateSellerFee, calculateSellerPayout, formatPrice } from "@/lib/fees";

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

  // eventos para poder "cambiarlo si se equivocó"
  const [events, setEvents] = useState([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [eventQuery, setEventQuery] = useState("");
  const [eventOpen, setEventOpen] = useState(false);
  const dropdownRef = useRef(null);

  const [selectedEvent, setSelectedEvent] = useState(null);

  // precio editable
  const [price, setPrice] = useState("");
  const [originalPrice, setOriginalPrice] = useState("");

  // tipo de venta (pero subasta aún deshabilitada)
  const [saleType, setSaleType] = useState("fixed"); // fixed | auction (futuro)
  const [autoEmergencyAuction, setAutoEmergencyAuction] = useState(false); // futuro (disabled)

  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState("");
  const [userRole, setUserRole] = useState("basic"); // Rol del usuario

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
    let mounted = true;

    async function loadDraftAndProfile() {
      try {
        const raw = localStorage.getItem(DRAFT_KEY);
        if (!raw) {
          router.replace("/sell");
          return;
        }
        const parsed = JSON.parse(raw);

        if (!parsed?.event_id) {
          router.replace("/sell");
          return;
        }
        if (!parsed?.ticketUpload?.uploaded) {
          router.replace("/sell/file");
          return;
        }

        if (!mounted) return;

        setDraft(parsed);
        setPrice(String(parsed?.price ?? ""));
        setOriginalPrice(parsed?.originalPrice ? String(parsed.originalPrice) : "");
        setEventQuery(parsed?.event_title || "");

        // Establecer evento seleccionado desde el draft
        if (parsed?.event_id) {
          setSelectedEvent({
            id: parsed.event_id,
            title: parsed.event_title || "Evento",
          });
        }

        // si en el draft había saleType (para futuro), lo tomo
        if (parsed?.saleType) setSaleType(parsed.saleType);
        if (parsed?.autoEmergencyAuction) setAutoEmergencyAuction(!!parsed.autoEmergencyAuction);

        // Obtener tipo de cuenta del usuario (user_type)
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('user_type')
              .eq('id', user.id)
              .maybeSingle();
            
            if (mounted) {
              setUserRole(profile?.user_type || 'standard');
            }
          }
        } catch (err) {
          console.error('Error obteniendo user_type del usuario:', err);
        }
      } catch {
        if (mounted) {
          router.replace("/sell");
        }
      }
    }

    loadDraftAndProfile();

    return () => {
      mounted = false;
    };
  }, [router]);

  // cargar eventos
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

      // Solo actualizar el evento seleccionado si encontramos más info en los eventos cargados
      if (draft?.event_id) {
        const found = normalized.find((x) => String(x.id) === String(draft.event_id));
        if (found) {
          setSelectedEvent(found);
          setEventQuery(found.title);
        }
      }
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

  function writeDraft(partial) {
    const nextDraft = { ...(draft || {}), ...(partial || {}) };
    setDraft(nextDraft);
    localStorage.setItem(DRAFT_KEY, JSON.stringify(nextDraft));
  }

  function selectEvent(ev) {
    setSelectedEvent(ev);
    setEventQuery(ev.title ?? "");
    setEventOpen(false);

    writeDraft({
      event_id: ev.id,
      event_title: ev.title || null,
    });
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
      // Verificar sesión antes de enviar
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      console.log('[Confirm] Session check:', { hasSession: !!session, userId: session?.user?.id, error: sessionError?.message });
      
      if (!session?.user) {
        setError("No hay sesión activa. Por favor inicia sesión de nuevo.");
        router.push(`/login?redirectTo=${encodeURIComponent("/sell/confirm")}`);
        return;
      }

      const payload = {
        eventId: selectedEvent?.id,
        price: Number(String(price).replace(/[^\d]/g, "")),
        
        // paso 1
        sector: draft?.sector || null,
        fila: draft?.fila || null,
        asiento: draft?.asiento || null,
      };

      console.log('[Confirm] Enviando payload:', payload);

      // Obtener token para auth
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      if (!token) {
        setError('Sesión expirada. Por favor inicia sesión de nuevo.');
        return;
      }

      const res = await fetch("/api/tickets/publish", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      // leer error real si pasa algo
      const raw = await res.text();
      let data = {};
      try {
        data = JSON.parse(raw);
      } catch {}

      if (!res.ok) {
        setError(
          data?.details
            ? `${data.error}: ${data.details}`
            : (data?.error || raw?.slice(0, 180) || "No se pudo publicar.")
        );
        return;
      }

      console.log('[Confirm] Respuesta exitosa:', data);

      localStorage.removeItem(DRAFT_KEY);
      
      // Redirigir al evento del ticket creado
      const redirectEventId = data?.ticket?.event_id || selectedEvent.id;
      console.log('[Confirm] Redirigiendo a evento:', redirectEventId);
      
      router.push(`/events/${redirectEventId}`);
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
          {/* Stepper */}
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
            <p className="mt-2 text-slate-600">Revisa el evento, ajusta el precio y publica tu entrada.</p>

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
                                {formatEventDate(ev.starts_at)}
                                {ev.venue ? ` • ${ev.venue}` : ""}
                                {ev.city ? ` • ${ev.city}` : ""}
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

            {/* Precio */}
            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="text-sm font-medium text-slate-700">
                  Precio de venta <span className="text-red-500">*</span>
                </label>
                <input
                  className="tix-input mt-2"
                  inputMode="numeric"
                  value={price}
                  onChange={(e) => {
                    const v = e.target.value.replace(/[^\d]/g, "");
                    setPrice(v);
                    writeDraft({ price: v });
                  }}
                />
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700">Precio original (opcional)</label>
                <input
                  className="tix-input mt-2"
                  inputMode="numeric"
                  value={originalPrice}
                  onChange={(e) => {
                    const v = e.target.value.replace(/[^\d]/g, "");
                    setOriginalPrice(v);
                    writeDraft({ originalPrice: v });
                  }}
                />
              </div>
            </div>

            {/* Resumen de comisiones */}
            {price && Number(price) > 0 && (
              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <div className="text-sm font-semibold text-slate-900 mb-3">Resumen de tu venta</div>
                
                {(() => {
                  const ticketPrice = Number(price);
                  const sellerFee = calculateSellerFee(ticketPrice, userRole);
                  const payout = calculateSellerPayout(ticketPrice, userRole);
                  const isFreeOrAdmin = userRole === 'free' || userRole === 'admin';

                  return (
                    <>
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-slate-600">Precio de venta</span>
                        <span className="font-semibold text-slate-900">{formatPrice(ticketPrice)}</span>
                      </div>
                      
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-slate-600">Cargo por servicio</span>
                        <span className={`font-semibold ${isFreeOrAdmin ? 'text-green-600' : 'text-slate-900'}`}>
                          {isFreeOrAdmin ? (
                            <span className="flex items-center gap-1">
                              {formatPrice(0)}
                              <span className="text-xs text-green-600 font-normal">(Cuenta {userRole.toUpperCase()})</span>
                            </span>
                          ) : (
                            <span className="flex items-center gap-1">
                              {formatPrice(sellerFee)}
                              <span className="text-xs text-slate-500 font-normal">(2.5% mín $1.200)</span>
                            </span>
                          )}
                        </span>
                      </div>

                      <div className="pt-3 mt-3 border-t border-slate-300 flex justify-between">
                        <span className="text-sm font-semibold text-slate-900">Tú recibes aprox.</span>
                        <span className="text-lg font-bold text-green-600">{formatPrice(payout)}</span>
                      </div>

                      {payout === 0 && (
                        <div className="mt-3 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
                          <p className="text-xs text-amber-800">
                            ⚠️ <strong>Atención:</strong> El cargo por servicio es igual o mayor al precio de venta.
                            Considera aumentar el precio para recibir un monto positivo.
                          </p>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            )}

            {/* Tipo de venta */}
            <div className="mt-8">
              <div className="text-sm font-medium text-slate-700">Tipo de venta</div>

              <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
                <button
                  type="button"
                  onClick={() => {
                    setSaleType("fixed");
                    writeDraft({ saleType: "fixed" });
                  }}
                  className={[
                    "rounded-2xl border p-5 text-left transition",
                    saleType === "fixed"
                      ? "border-blue-500 bg-blue-50 ring-4 ring-blue-100"
                      : "border-slate-200 hover:bg-slate-50",
                  ].join(" ")}
                >
                  <div className="font-semibold text-slate-900">Precio fijo</div>
                  <div className="mt-1 text-sm text-slate-600">
                    Vende inmediatamente al precio que estableciste
                  </div>
                </button>

                <button
                  type="button"
                  disabled
                  className="rounded-2xl border border-slate-200 bg-white p-5 text-left"
                  title="Pronto estará disponible"
                >
                  <div className="font-semibold text-slate-900">Subasta</div>
                  <div className="mt-1 text-sm text-slate-600">
                    Pronto estará disponible. Deja que los compradores pujen por tu entrada.
                  </div>
                </button>
              </div>

              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-5">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    disabled
                    checked={autoEmergencyAuction}
                    onChange={(e) => {
                      setAutoEmergencyAuction(e.target.checked);
                      writeDraft({ autoEmergencyAuction: e.target.checked });
                    }}
                    className="mt-1 h-4 w-4 cursor-not-allowed"
                  />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 font-semibold text-amber-900">
                      <span>Subasta automática de emergencia</span>
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                        Se viene pronto
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-amber-800">
                      Si mi entrada no se vende, permitir que se active automáticamente una subasta 2 horas antes del evento.
                      Los compradores podrán pujar y se enviará un email a cada uno cuando sea superado.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Información de pago y Wallet */}
            <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-5">
              <h3 className="text-lg font-semibold text-slate-900">Antes de publicar</h3>
              <ul className="mt-2 text-sm text-slate-700 space-y-1">
                <li>• Pago al vendedor: 3 a 5 días hábiles post evento.</li>
                <li>• Configura tu Wallet para recibir pagos. Si no la configuras, el dinero quedará pendiente hasta que la actives.</li>
                <li>• Publica solo tickets reales y no duplicados.</li>
                <li>• Si la entrada es nominada, habrá chat comprador↔vendedor para coordinar la nominación.</li>
              </ul>
              <div className="mt-3">
                <a 
                  href="/dashboard?tab=wallet&return=/sell/confirm" 
                  className="tix-btn-secondary inline-block text-center"
                >
                  Configurar Wallet
                </a>
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
