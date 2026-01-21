// app/admin/soporte/page.jsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

const STATUS = [
  { v: "submitted", l: "Enviado" },
  { v: "in_review", l: "En revisión" },
  { v: "waiting_user", l: "Pendiente de antecedentes" },
  { v: "rejected", l: "Rechazado" },
  { v: "resolved", l: "Finalizado" },
];

const CATEGORY_LABEL = (c) => {
  if (c === "soporte") return "Soporte general";
  if (c === "disputa_compra") return "Disputa por compra";
  if (c === "disputa_venta") return "Disputa por venta";
  if (c === "reclamo") return "Reclamo";
  if (c === "sugerencia") return "Sugerencia";
  if (c === "otro") return "Otro";
  return c || "—";
};

function pillClass(status) {
  const base = "px-3 py-1 rounded-full text-xs font-semibold border";
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

function fmtCL(dt) {
  if (!dt) return "—";
  return new Date(dt).toLocaleString("es-CL", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function fmtBytes(n) {
  const x = Number(n || 0);
  if (!x) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let v = x;
  while (v >= 1024 && i < units.length - 1) {
    v = v / 1024;
    i++;
  }
  return `${v.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function isOverdue(ticket) {
  if (!ticket?.due_at) return false;
  if (ticket.status === "resolved" || ticket.status === "rejected") return false;
  return new Date(ticket.due_at).getTime() < Date.now();
}

export default function AdminSupportConsole() {
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

  const [adminStatus, setAdminStatus] = useState("");
  const [savingStatus, setSavingStatus] = useState(false);

  const [draft, setDraft] = useState("");
  const [uploading, setUploading] = useState(false);
  const [pendingUploads, setPendingUploads] = useState([]); // [{id, file_name, signed_url, mime_type}]
  const [sending, setSending] = useState(false);

  const [err, setErr] = useState("");

  const getAccessToken = async () => {
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token || null;
  };

  const ensureAdmin = async () => {
    const { data } = await supabase.auth.getUser();
    const user = data?.user;
    if (!user) return { ok: false };

    const { data: prof } = await supabase
      .from("profiles")
      .select("user_type")
      .eq("id", user.id)
      .maybeSingle();

    if (prof?.user_type !== "admin") return { ok: false };
    return { ok: true };
  };

  const refreshList = async () => {
    setLoadingList(true);
    setErr("");

    try {
      const token = await getAccessToken();
      const url = new URL(window.location.origin + "/support/admin/tickets");
      url.searchParams.set("q", q.trim());
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
      const url = new URL(window.location.origin + "/support/admin/ticket");
      url.searchParams.set("id", ticketId);

      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${token}` },
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "No pudimos abrir el ticket");

      setSelected(json.ticket);
      setAdminStatus(json.ticket?.status || "submitted");
      setMessages(json.messages || []);
      setAttachments(json.attachments || []);
    } catch (e) {
      setErr(e.message || "Error abriendo ticket");
      setSelected(null);
      setMessages([]);
      setAttachments([]);
      setAdminStatus("");
    } finally {
      setLoadingDetail(false);
    }
  };

  useEffect(() => {
    const init = async () => {
      setBoot(true);

      const admin = await ensureAdmin();
      if (!admin.ok) {
        router.push("/dashboard");
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

  const looseAttachments = useMemo(() => {
    return (attachments || []).filter((a) => !a.message_id);
  }, [attachments]);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return tickets;
    return tickets.filter((t) => {
      const n = `ts-${t.ticket_number || ""}`.toLowerCase();
      const subj = (t.subject || "").toLowerCase();
      const email = (t.requester_email || "").toLowerCase();
      const rut = (t.requester_rut || "").toLowerCase();
      return (
        n.includes(qq) ||
        subj.includes(qq) ||
        email.includes(qq) ||
        rut.includes(qq)
      );
    });
  }, [q, tickets]);

  const canReply =
    !!selected && ["submitted", "in_review", "waiting_user"].includes(adminStatus);

  const handleUpdateStatus = async () => {
    if (!selected?.id) return;
    setSavingStatus(true);
    setErr("");

    try {
      const token = await getAccessToken();
      const res = await fetch("/support/admin/status", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ticket_id: selected.id,
          status: adminStatus,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "No se pudo guardar el estado");

      await loadDetail(selected.id);
      await refreshList();
    } catch (e) {
      setErr(e.message || "Error guardando estado");
    } finally {
      setSavingStatus(false);
    }
  };

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
              Soporte · Admin
            </h1>
            <p className="text-sm text-slate-500">
              Cola de tickets + chat + adjuntos + SLA.
            </p>
          </div>

          <button
            onClick={() => router.push("/dashboard")}
            className="text-sm px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50"
          >
            Volver a mi cuenta
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
                placeholder="Buscar TS-1001, correo, rut..."
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
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-xs font-semibold text-slate-700">
                        TS-{t.ticket_number}
                      </div>
                      <span className={pillClass(t.status)}>
                        {STATUS.find((x) => x.v === t.status)?.l || t.status}
                      </span>
                    </div>

                    <p className="text-sm font-semibold text-slate-900 line-clamp-1 mt-1">
                      {t.subject || "Sin asunto"}
                    </p>

                    <p className="text-xs text-slate-500 line-clamp-1 mt-1">
                      {CATEGORY_LABEL(t.category)} ·{" "}
                      {t.requester_email ? t.requester_email : "—"}
                    </p>

                    <p className="text-xs text-slate-500 line-clamp-1 mt-1">
                      Último: {fmtCL(t.last_message_at || t.created_at)} · Vence:{" "}
                      {fmtCL(t.due_at)}
                      {isOverdue(t) ? (
                        <span className="ml-2 text-rose-600 font-semibold">
                          (Atrasado)
                        </span>
                      ) : null}
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
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">
                      TS-{selected.ticket_number}
                    </h2>
                    <p className="text-sm text-slate-700 mt-1 font-semibold">
                      {selected.subject}
                    </p>

                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className={pillClass(selected.status)}>
                        {STATUS.find((x) => x.v === selected.status)?.l ||
                          selected.status}
                      </span>
                      <span className="text-xs text-slate-500">
                        {CATEGORY_LABEL(selected.category)}
                      </span>
                    </div>

                    <p className="text-xs text-slate-500 mt-2">
                      {selected.category === "disputa_compra" ||
                      selected.category === "disputa_venta" ? (
                        <>
                          disputa · Creado: {fmtCL(selected.created_at)} · Vence:{" "}
                          {fmtCL(selected.due_at)}
                        </>
                      ) : (
                        <>
                          Creado: {fmtCL(selected.created_at)} · Vence:{" "}
                          {fmtCL(selected.due_at)}
                        </>
                      )}
                    </p>

                    <p className="text-xs text-slate-500 mt-1">
                      Usuario:{" "}
                      <b className="text-slate-700">
                        {selected.requester_name || "—"}
                      </b>{" "}
                      · {selected.requester_email || "—"}{" "}
                      {selected.requester_rut ? (
                        <>
                          · RUT{" "}
                          <span className="text-slate-700">
                            {selected.requester_rut}
                          </span>
                        </>
                      ) : null}
                    </p>
                  </div>

                  <div className="min-w-[260px]">
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Estado del ticket
                    </label>
                    <div className="flex items-center gap-2">
                      <select
                        value={adminStatus}
                        onChange={(e) => setAdminStatus(e.target.value)}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white"
                      >
                        {STATUS.map((s) => (
                          <option key={s.v} value={s.v}>
                            {s.l}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={handleUpdateStatus}
                        disabled={savingStatus}
                        className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-60"
                      >
                        {savingStatus ? "Guardando…" : "Guardar"}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="mt-5 border-t border-slate-100 pt-4">
                  <h3 className="text-sm font-semibold text-slate-900 mb-3">
                    Conversación
                  </h3>

                  {looseAttachments.length ? (
                    <div className="mb-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2">
                      <div className="text-xs font-semibold text-amber-800">
                        Adjuntos del ticket (sin mensaje)
                      </div>
                      <div className="mt-2 space-y-1">
                        {looseAttachments.map((a) => (
                          <a
                            key={a.id}
                            href={a.signed_url || "#"}
                            target="_blank"
                            rel="noreferrer"
                            download={a.file_name || undefined}
                            className="block text-xs text-blue-700 hover:underline"
                          >
                            📎 {a.file_name || "archivo"}{" "}
                            <span className="text-slate-500">
                              ({a.mime_type || "—"} · {fmtBytes(a.file_size)})
                            </span>
                          </a>
                        ))}
                      </div>
                      <div className="mt-1 text-[11px] text-amber-700">
                        Tip: el link expira en ~30 min. Si expira, recarga el ticket.
                      </div>
                    </div>
                  ) : null}

                  <div className="space-y-3 max-h-[46vh] overflow-auto pr-1">
                    {messages.map((m) => {
                      const mine = m.sender_type === "admin";
                      const related = attachments.filter((a) => a.message_id === m.id);
                      return (
                        <div
                          key={m.id}
                          className={`flex ${mine ? "justify-end" : "justify-start"}`}
                        >
                          <div
                            className={`max-w-[85%] rounded-2xl border px-3 py-2 ${
                              mine
                                ? "bg-blue-50 border-blue-100"
                                : "bg-slate-50 border-slate-100"
                            }`}
                          >
                            <div className="text-[11px] text-slate-500 flex items-center justify-between gap-3">
                              <span className="font-semibold">
                                {mine ? "TixSwap (Admin)" : "Usuario"}
                              </span>
                              <span>{fmtCL(m.created_at)}</span>
                            </div>

                            {m.body ? (
                              <p className="text-sm text-slate-800 whitespace-pre-line mt-1">
                                {m.body}
                              </p>
                            ) : null}

                            {related.length ? (
                              <div className="mt-2 space-y-1">
                                {related.map((a) => (
                                  <a
                                    key={a.id}
                                    href={a.signed_url || "#"}
                                    target="_blank"
                                    rel="noreferrer"
                                    download={a.file_name || undefined}
                                    className="block text-xs text-blue-700 hover:underline"
                                  >
                                    📎 {a.file_name || "archivo"}{" "}
                                    <span className="text-slate-400">
                                      ({a.mime_type || "—"} · {fmtBytes(a.file_size)})
                                    </span>
                                  </a>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <label className="text-sm font-semibold text-slate-900">
                        Responder
                      </label>

                      <label
                        className={`text-xs font-semibold cursor-pointer ${
                          canReply ? "text-blue-700" : "text-slate-400 cursor-not-allowed"
                        }`}
                      >
                        {uploading ? "Subiendo…" : "Adjuntar"}
                        <input
                          type="file"
                          multiple
                          onChange={canReply ? onPickFiles : undefined}
                          className="hidden"
                          accept="application/pdf,image/*,audio/*"
                          disabled={!canReply || uploading}
                        />
                      </label>
                    </div>

                    {!canReply ? (
                      <p className="mt-2 text-xs text-slate-500">
                        Este ticket está cerrado. Si necesitas seguir, crea uno nuevo.
                      </p>
                    ) : (
                      <>
                        {pendingUploads.length ? (
                          <div className="mt-2 text-xs text-slate-600 space-y-1">
                            {pendingUploads.map((a) => (
                              <div key={a.id}>📎 {a.file_name}</div>
                            ))}
                          </div>
                        ) : null}

                        <textarea
                          value={draft}
                          onChange={(e) => setDraft(e.target.value)}
                          placeholder="Escribe tu respuesta al usuario…"
                          className="mt-3 w-full border border-slate-200 rounded-xl px-3 py-2 text-sm min-h-[90px] bg-white"
                        />

                        <div className="mt-3 flex justify-end">
                          <button
                            onClick={sendMessage}
                            disabled={sending || uploading}
                            className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-60"
                          >
                            {sending ? "Enviando…" : "Enviar mensaje"}
                          </button>
                        </div>

                        <p className="mt-2 text-[11px] text-slate-500">
                          Al responder, TixSwap envía correo al usuario (si configuraste Resend).
                        </p>
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

