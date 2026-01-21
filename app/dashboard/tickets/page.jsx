// app/dashboard/tickets/page.jsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { statusLabel, statusBadgeClass, canChat, TICKET_STATUS, isTerminalStatus } from "@/lib/support/status";

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

function fmtCL(dt) {
  if (!dt) return "—";
  return new Date(dt).toLocaleString("es-CL", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export default function MyTicketsPage() {
  const router = useRouter();

  const [boot, setBoot] = useState(true);
  const [tickets, setTickets] = useState([]);
  const [loadingList, setLoadingList] = useState(true);

  const [selectedId, setSelectedId] = useState(null);
  const [selected, setSelected] = useState(null);
  const [messages, setMessages] = useState([]);
  const [attachments, setAttachments] = useState([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [draft, setDraft] = useState("");
  const [pendingUploads, setPendingUploads] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);

  const [err, setErr] = useState("");

  const getAccessToken = async () => {
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token || null;
  };

  const refreshList = async () => {
    setLoadingList(true);
    setErr("");

    try {
      const token = await getAccessToken();
      const url = new URL(window.location.origin + "/support/my/tickets");
      url.searchParams.set("status", statusFilter);

      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${token}` },
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "No pudimos cargar tickets");

      setTickets(json.tickets || []);
      if (!selectedId && (json.tickets || []).length) setSelectedId(json.tickets[0].id);
    } catch (e) {
      setErr(e.message || "Error cargando tickets");
      setTickets([]);
    } finally {
      setLoadingList(false);
    }
  };

  const loadDetail = async (ticketId) => {
    setLoadingDetail(true);
    setErr("");
    setDraft("");
    setPendingUploads([]);

    try {
      const token = await getAccessToken();
      const url = new URL(window.location.origin + "/support/my/ticket");
      url.searchParams.set("id", ticketId);

      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${token}` },
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "No pudimos abrir el ticket");

      setSelected(json.ticket);
      setMessages(json.messages || []);
      setAttachments(json.attachments || []);
    } catch (e) {
      setErr(e.message || "Error abriendo ticket");
      setSelected(null);
      setMessages([]);
      setAttachments([]);
    } finally {
      setLoadingDetail(false);
    }
  };

  useEffect(() => {
    const init = async () => {
      setBoot(true);
      const { data } = await supabase.auth.getUser();
      if (!data?.user) {
        router.push("/login");
        return;
      }
      setBoot(false);
      await refreshList();
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (boot) return;
    refreshList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  useEffect(() => {
    if (!selectedId) return;
    loadDetail(selectedId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return tickets;
    return tickets.filter((t) => {
      const n = `ts-${t.ticket_number || ""}`.toLowerCase();
      const subj = (t.subject || "").toLowerCase();
      return n.includes(qq) || subj.includes(qq);
    });
  }, [q, tickets]);

  const onPickFiles = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length || !selected?.id) return;

    setUploading(true);
    setErr("");

    try {
      const token = await getAccessToken();
      const uploaded = [];

      for (const f of files) {
        const form = new FormData();
        form.append("ticketId", selected.id);
        form.append("file", f);

        const res = await fetch("/support/upload", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: form,
        });

        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || "Upload falló");

        uploaded.push(json.attachment);
      }

      setPendingUploads((prev) => [...prev, ...uploaded]);
      e.target.value = "";
    } catch (e2) {
      setErr(e2.message || "Error subiendo archivos");
    } finally {
      setUploading(false);
    }
  };

  const canReply = !!selected && canChat(selected.status);
  const isTicketClosed = selected && isTerminalStatus(selected.status);

  const handleReopenTicket = async () => {
    if (!selected?.id) return;

    setSending(true);
    setErr("");

    try {
      const token = await getAccessToken();
      const res = await fetch("/support/message", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ticket_id: selected.id,
          body: "Ticket reabierto por el usuario",
          reopen: true,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "No se pudo reabrir el ticket");

      await loadDetail(selected.id);
      await refreshList();
    } catch (e) {
      setErr(e.message || "Error reabriendo ticket");
    } finally {
      setSending(false);
    }
  };

  const sendMessage = async () => {
    if (!selected?.id) return;
    if (!draft.trim() && pendingUploads.length === 0) {
      setErr("Escribe un mensaje o adjunta algo.");
      return;
    }

    setSending(true);
    setErr("");

    try {
      const token = await getAccessToken();
      const res = await fetch("/support/message", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ticket_id: selected.id,
          body: draft.trim(),
          attachment_ids: pendingUploads.map((a) => a.id),
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "No se pudo enviar el mensaje");

      setDraft("");
      setPendingUploads([]);
      await loadDetail(selected.id);
      await refreshList();
    } catch (e) {
      setErr(e.message || "Error enviando mensaje");
    } finally {
      setSending(false);
    }
  };

  if (boot) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-sm text-slate-500">Cargando…</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 py-10">
        <div className="flex items-start justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold text-slate-900">
              Mis tickets
            </h1>
            <p className="text-sm text-slate-500">
              Aquí queda el historial y el chat con soporte.
            </p>
          </div>

          <button
            onClick={() => router.push("/dashboard")}
            className="text-sm px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50"
          >
            Volver al panel
          </button>
        </div>

        {err ? (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {err}
          </div>
        ) : null}

        <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-4">
          {/* LISTA */}
          <div className="bg-white border border-slate-100 rounded-2xl p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-semibold text-slate-900">Tickets</h2>
              <button
                onClick={refreshList}
                className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50"
              >
                Recargar
              </button>
            </div>

            <div className="mt-3">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar TS-1001 o asunto..."
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
              />
            </div>

            <div className="mt-2">
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                Estado
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white"
              >
                <option value="all">Todos</option>
                {STATUS.map((s) => (
                  <option key={s.v} value={s.v}>
                    {s.l}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-4 space-y-2 max-h-[70vh] overflow-auto pr-1">
              {loadingList ? (
                <p className="text-sm text-slate-500">Cargando…</p>
              ) : filtered.length === 0 ? (
                <p className="text-sm text-slate-500">No hay tickets.</p>
              ) : (
                filtered.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setSelectedId(t.id)}
                    className={`w-full text-left rounded-2xl border px-3 py-3 hover:bg-slate-50 ${
                      selectedId === t.id
                        ? "border-blue-200 bg-blue-50/40"
                        : "border-slate-100 bg-white"
                    }`}
                  >
                    <div className="text-xs font-semibold text-slate-700">
                      TS-{t.ticket_number}
                    </div>
                    <p className="text-sm font-semibold text-slate-900 line-clamp-1 mt-1">
                      {t.subject || "Sin asunto"}
                    </p>
                    <p className="text-xs text-slate-500 line-clamp-1 mt-1">
                      {CATEGORY_LABEL(t.category)} · Último:{" "}
                      {fmtCL(t.last_message_at || t.created_at)}
                    </p>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* DETALLE */}
          <div className="bg-white border border-slate-100 rounded-2xl p-4">
            {!selected ? (
              <p className="text-sm text-slate-500">
                Selecciona un ticket para verlo.
              </p>
            ) : loadingDetail ? (
              <p className="text-sm text-slate-500">Cargando ticket…</p>
            ) : (
              <>
                <div>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h2 className="text-xl font-bold text-slate-900">
                          {selected.code || `TS-${selected.ticket_number}`}
                        </h2>
                        <span className={statusBadgeClass(selected.status)}>
                          {statusLabel(selected.status)}
                        </span>
                      </div>
                      <p className="text-sm text-slate-700 font-semibold">
                        {selected.subject}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        {CATEGORY_LABEL(selected.category)} · Creado: {fmtCL(selected.created_at)}
                      </p>
                    </div>
                    <button
                      onClick={() => router.push("/dashboard/soporte")}
                      className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50"
                    >
                      ← Volver
                    </button>
                  </div>

                  {/* AVISOS DE ESTADO */}
                  {isTicketClosed && (
                    <div className="mt-4 bg-slate-100 border border-slate-200 rounded-xl p-4">
                      <div className="flex items-start gap-3">
                        <svg className="w-5 h-5 text-slate-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-slate-900">
                            Este ticket está {selected.status === TICKET_STATUS.CLOSED ? 'cerrado' : 'resuelto'}
                          </p>
                          <p className="text-xs text-slate-600 mt-1">
                            Si necesitas seguimiento, puedes reabrirlo o crear un nuevo ticket
                          </p>
                          <button
                            onClick={handleReopenTicket}
                            disabled={sending}
                            className="mt-3 text-xs px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50"
                          >
                            {sending ? "Reabriendo..." : "🔓 Reabrir ticket"}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {selected.status === TICKET_STATUS.WAITING_USER && (
                    <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-4">
                      <div className="flex items-start gap-3">
                        <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-amber-900">
                            Necesitamos más información de tu parte
                          </p>
                          <p className="text-xs text-amber-700 mt-1">
                            Por favor responde con los detalles solicitados para continuar
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-4 border-t border-slate-100 pt-4">
                  <h3 className="text-sm font-semibold text-slate-900 mb-3">
                    Conversación
                  </h3>

                  <div className="space-y-3 max-h-[46vh] overflow-auto pr-1">
                    {messages.length === 0 ? (
                      <div className="text-center py-8">
                        <svg className="w-12 h-12 mx-auto text-slate-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                        <p className="text-sm text-slate-500">No hay mensajes aún</p>
                      </div>
                    ) : (
                      messages.map((m) => {
                        const mine = m.sender_type === "user" || m.sender_role === "user";
                        const related = attachments.filter((a) => a.message_id === m.id);
                        return (
                          <div
                            key={m.id}
                            className={`flex ${mine ? "justify-end" : "justify-start"}`}
                          >
                            <div
                              className={`max-w-[85%] rounded-2xl border px-4 py-3 ${
                                mine
                                  ? "bg-blue-50 border-blue-200"
                                  : "bg-white border-slate-200 shadow-sm"
                              }`}
                            >
                              <div className="flex items-center gap-2 mb-1">
                                {!mine && (
                                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
                                    <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-6-3a2 2 0 11-4 0 2 2 0 014 0zm-2 4a5 5 0 00-4.546 2.916A5.986 5.986 0 0010 16a5.986 5.986 0 004.546-2.084A5 5 0 0010 11z" clipRule="evenodd" />
                                    </svg>
                                  </div>
                                )}
                                <div className="flex-1 min-w-0">
                                  <div className="text-[11px] font-bold tracking-wide uppercase text-slate-500">
                                    {mine ? "Tú" : "Soporte TixSwap"}
                                  </div>
                                  <div className="text-[10px] text-slate-400">
                                    {fmtCL(m.created_at)}
                                  </div>
                                </div>
                              </div>

                              {m.body ? (
                                <p className="text-sm text-slate-800 whitespace-pre-line">
                                  {m.body}
                                </p>
                              ) : null}

                              {related.length > 0 && (
                                <div className="mt-3 space-y-1.5">
                                  {related.map((a) => (
                                    <a
                                      key={a.id}
                                      href={a.signed_url || "#"}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="flex items-center gap-2 text-xs text-blue-700 hover:text-blue-800 hover:underline group"
                                    >
                                      <svg className="w-4 h-4 flex-shrink-0 group-hover:scale-110 transition" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                                      </svg>
                                      <span className="flex-1 truncate">{a.file_name || "archivo"}</span>
                                      <span className="text-[10px] text-slate-400">
                                        {a.file_size ? `${Math.round(a.file_size / 1024)}KB` : ""}
                                      </span>
                                    </a>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    {!canReply ? (
                      <div className="text-center py-4">
                        <p className="text-sm text-slate-600 mb-3">
                          Este ticket está {selected.status === TICKET_STATUS.CLOSED ? 'cerrado' : 'resuelto'}
                        </p>
                        {isTicketClosed && (
                          <button
                            onClick={handleReopenTicket}
                            disabled={sending}
                            className="text-sm px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50"
                          >
                            {sending ? "Reabriendo..." : "Reabrir ticket"}
                          </button>
                        )}
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center justify-between gap-2 mb-3">
                          <label className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                            <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                            </svg>
                            Tu respuesta
                          </label>

                          <label className="text-xs font-semibold cursor-pointer px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition flex items-center gap-1.5">
                            {uploading ? (
                              <>
                                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600"></div>
                                <span>Subiendo...</span>
                              </>
                            ) : (
                              <>
                                <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                                </svg>
                                <span>Adjuntar</span>
                              </>
                            )}
                            <input
                              type="file"
                              multiple
                              onChange={onPickFiles}
                              className="hidden"
                              accept="application/pdf,image/*,audio/*"
                              disabled={uploading}
                            />
                          </label>
                        </div>

                        {pendingUploads.length > 0 && (
                          <div className="mb-3 p-3 bg-blue-50 border border-blue-100 rounded-lg">
                            <div className="text-xs font-semibold text-blue-900 mb-2">
                              📎 {pendingUploads.length} archivo{pendingUploads.length > 1 ? 's' : ''} adjunto{pendingUploads.length > 1 ? 's' : ''}:
                            </div>
                            <div className="space-y-1">
                              {pendingUploads.map((a) => (
                                <div key={a.id} className="flex items-center justify-between gap-2 text-xs text-blue-800">
                                  <span className="flex-1 truncate">{a.file_name}</span>
                                  <button
                                    onClick={() => setPendingUploads(prev => prev.filter(x => x.id !== a.id))}
                                    className="text-blue-600 hover:text-blue-800"
                                  >
                                    ✕
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <textarea
                          value={draft}
                          onChange={(e) => setDraft(e.target.value)}
                          placeholder="Escribe tu mensaje aquí..."
                          rows={4}
                          className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                        />

                        <div className="mt-3 flex items-center justify-between gap-3">
                          <div className="text-xs text-slate-500">
                            {draft.trim().length > 0 && `${draft.trim().length} caracteres`}
                          </div>
                          <button
                            onClick={sendMessage}
                            disabled={sending || (!draft.trim() && pendingUploads.length === 0)}
                            className="px-5 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-2"
                          >
                            {sending ? (
                              <>
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                <span>Enviando...</span>
                              </>
                            ) : (
                              <>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                </svg>
                                <span>Enviar</span>
                              </>
                            )}
                          </button>
                        </div>
                          <button
                            onClick={sendMessage}
                            disabled={sending || uploading}
                            className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-60"
                          >
                            {sending ? "Enviando…" : "Enviar mensaje"}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

