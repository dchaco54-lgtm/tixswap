"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

const CATEGORY_LABEL = (c) => {
  if (c === "soporte") return "Soporte general";
  if (c === "disputa_compra") return "Disputa por compra";
  if (c === "disputa_venta") return "Disputa por venta";
  if (c === "reclamo") return "Reclamo";
  if (c === "sugerencia") return "Sugerencia";
  if (c === "cambio_datos") return "Cambio de datos";
  if (c === "otro") return "Otro";
  return c || "—";
};

function pill(status) {
  const base = "px-3 py-1 rounded-full text-xs font-extrabold border";
  if (status === "resolved")
    return base + " bg-emerald-50 text-emerald-700 border-emerald-200";
  if (status === "rejected")
    return base + " bg-rose-50 text-rose-700 border-rose-200";
  if (status === "waiting_user")
    return base + " bg-amber-50 text-amber-800 border-amber-200";
  if (status === "in_review")
    return base + " bg-blue-50 text-blue-700 border-blue-200";
  if (status === "submitted")
    return base + " bg-slate-50 text-slate-700 border-slate-200";
  return base + " bg-slate-50 text-slate-700 border-slate-200";
}

function SoporteContent() {
  const router = useRouter();
  const sp = useSearchParams();

  const [booting, setBooting] = useState(true);

  const [tickets, setTickets] = useState([]);
  const [loadingTickets, setLoadingTickets] = useState(false);

  const [category, setCategory] = useState("soporte");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  const [creating, setCreating] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const prefill = useMemo(() => {
    const isNew = sp.get("new") === "1";
    return {
      isNew,
      category: sp.get("category") || "",
      subject: sp.get("subject") || "",
      message: sp.get("message") || "",
    };
  }, [sp]);

  useEffect(() => {
    const init = async () => {
      setBooting(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      // aplica prefill
      if (prefill.isNew) {
        if (prefill.category) setCategory(prefill.category);
        if (prefill.subject) setSubject(prefill.subject);
        if (prefill.message) setMessage(prefill.message);
      }

      await loadTickets();
      setBooting(false);
    };

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadTickets = async () => {
    setLoadingTickets(true);
    setErr("");
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const token = session?.access_token;
      if (!token) throw new Error("Sesión inválida (sin token).");

      const res = await fetch("/support/my/tickets?status=all", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Error cargando tickets");

      setTickets(json.tickets || []);
    } catch (e) {
      setErr(e?.message || "No pude cargar tickets.");
    } finally {
      setLoadingTickets(false);
    }
  };

  const createTicket = async () => {
    setCreating(true);
    setMsg("");
    setErr("");

    try {
      const s = String(subject || "").trim();
      const m = String(message || "").trim();

      if (!s) throw new Error("Pon un asunto.");
      if (!m) throw new Error("Escribe un mensaje.");

      const {
        data: { session },
      } = await supabase.auth.getSession();

      const token = session?.access_token;
      if (!token) throw new Error("Sesión inválida (sin token).");

      const res = await fetch("/support/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          category,
          subject: s,
          body: m,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        const errText = json?.error
          ? json?.details
            ? `${json.error}: ${json.details}`
            : json.error
          : "No se pudo crear el ticket";
        throw new Error(errText);
      }

      // Mostrar mensaje de éxito con código del ticket
      const ticketNumber = json.ticket_number || json.ticket?.ticket_number || "—";
      const ticketCode = json.ticket?.code || `TS-${ticketNumber}`;
      setMsg(`Ticket ${ticketCode} creado exitosamente ✅`);
      
      // Limpiar formulario
      setSubject("");
      setMessage("");
      setCategory("soporte");

      await loadTickets();

      // Redirigir automáticamente a la conversación del ticket creado
      const createdId = json.ticketId || json.ticket?.id;
      if (createdId) {
        // Pequeño delay para que el usuario vea el mensaje de éxito
        setTimeout(() => {
          router.push(`/dashboard/tickets?open=${encodeURIComponent(createdId)}`);
        }, 800);
      }
    } catch (e) {
      setErr(e?.message || "No se pudo crear el ticket.");
    } finally {
      setCreating(false);
    }
  };

  if (booting) {
    return (
      <div className="min-h-screen bg-[#f4f7ff]">
        <div className="tix-container py-10">
          <div className="tix-card p-6 text-slate-600">Cargando soporte…</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f4f7ff]">
      <div className="tix-container py-10">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900">Soporte</h1>
            <p className="text-slate-600 mt-1">
              Crea un ticket y revisa tu historial.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={() => router.push("/dashboard")} className="tix-btn-ghost">
              Volver
            </button>
            <button onClick={loadTickets} className="tix-btn-ghost">
              Recargar
            </button>
          </div>
        </div>

        {(msg || err) && (
          <div className="mb-6">
            {msg && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-800 font-semibold">
                {msg}
              </div>
            )}
            {err && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-800 font-semibold mt-3">
                {err}
              </div>
            )}
          </div>
        )}

        <div className="grid lg:grid-cols-2 gap-6">
          {/* CREAR TICKET */}
          <div className="tix-card p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-extrabold text-slate-900">
                  Crear nuevo ticket
                </h2>
                <p className="text-xs text-slate-600">
                  Respuesta en menos de 24 horas hábiles
                </p>
              </div>
            </div>

            <p className="text-slate-600 mt-4">
              Mientras más claro, más rápido lo resolvemos 😉
            </p>

            <div className="mt-4 space-y-3">
              <div>
                <div className="text-xs font-bold text-slate-500 mb-1">
                  Categoría
                </div>
                <select
                  className="tix-select"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  <option value="soporte">Soporte general</option>
                  <option value="reclamo">Reclamo</option>
                  <option value="sugerencia">Sugerencia</option>
                  <option value="disputa_compra">Disputa por compra</option>
                  <option value="disputa_venta">Disputa por venta</option>
                  <option value="otro">Otro</option>
                </select>
              </div>

              <div>
                <div className="text-xs font-bold text-slate-500 mb-1">
                  Asunto
                </div>
                <input
                  className="tix-input"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Ej: Solicitud de cambio de RUT"
                />
              </div>

              <div>
                <div className="text-xs font-bold text-slate-500 mb-1">
                  Mensaje
                </div>
                <textarea
                  className="tix-textarea"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Cuéntanos qué pasó…"
                />
              </div>

              <button
                onClick={createTicket}
                disabled={creating}
                className="tix-btn-primary w-full justify-center"
              >
                {creating ? "Creando…" : "Crear ticket"}
              </button>
            </div>
          </div>

          {/* LISTA */}
          <div className="tix-card p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-extrabold text-slate-900">
                Mis tickets
              </h2>
              <button
                onClick={() => router.push("/dashboard/tickets")}
                className="tix-btn-ghost"
              >
                Ver conversación
              </button>
            </div>

            <div className="mt-4">
              {loadingTickets ? (
                <p className="text-slate-600">Cargando…</p>
              ) : tickets.length === 0 ? (
                <div className="rounded-2xl border border-slate-100 bg-white px-4 py-4 text-slate-600">
                  Aún no tienes tickets.
                </div>
              ) : (
                <div className="space-y-2">
                  {tickets.slice(0, 25).map((t) => (
                    <button
                      key={t.id}
                      onClick={() =>
                        router.push(`/dashboard/tickets?open=${encodeURIComponent(t.id)}`)
                      }
                      className="w-full text-left rounded-2xl border border-slate-100 bg-white px-4 py-3 hover:bg-slate-50 transition"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm font-extrabold text-slate-900">
                          TS-{t.ticket_number}
                        </div>
                        <span className={pill(t.status)}>{t.status}</span>
                      </div>
                      <div className="text-sm font-semibold text-slate-800 mt-1 line-clamp-1">
                        {t.subject || "Sin asunto"}
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        {CATEGORY_LABEL(t.category)} ·{" "}
                        {t.created_at
                          ? new Date(t.created_at).toLocaleString("es-CL", {
                              dateStyle: "short",
                              timeStyle: "short",
                            })
                          : "—"}
                      </div>
                    </button>
                  ))}
                  {tickets.length > 25 && (
                    <div className="text-xs text-slate-500 mt-2">
                      Mostrando 25 de {tickets.length}. En “Ver conversación” los ves todos.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SoportePage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Cargando...</div>}>
      <SoporteContent />
    </Suspense>
  );
}
