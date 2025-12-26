"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { canChat, statusLabel } from "@/lib/support/status";

export default function TicketDetail({ params }) {
  const ticketId = params.ticketId;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const [text, setText] = useState("");
  const [files, setFiles] = useState([]);
  const [sending, setSending] = useState(false);

  const bottomRef = useRef(null);

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/support/tickets/${ticketId}`, { cache: "no-store" });
    const json = await res.json();
    setData(json);
    setLoading(false);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  }

  useEffect(() => { load(); }, [ticketId]);

  const attachmentsByMessage = useMemo(() => {
    const map = new Map();
    (data?.attachments ?? []).forEach(a => {
      const key = a.message_id ?? "none";
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(a);
    });
    return map;
  }, [data]);

  const ticket = data?.ticket;
  const messages = data?.messages ?? [];

  const chatEnabled = ticket ? canChat(ticket.status) : false;

  async function send() {
    if (!chatEnabled) return;
    if (!text.trim() && files.length === 0) return;

    setSending(true);

    const form = new FormData();
    form.append("body", text.trim());
    for (const f of files) form.append("files", f);

    const res = await fetch(`/api/support/tickets/${ticketId}/messages`, {
      method: "POST",
      body: form,
    });

    const json = await res.json();
    setSending(false);

    if (!res.ok) {
      alert(json.error ?? "Error enviando mensaje");
      return;
    }

    setText("");
    setFiles([]);
    await load();
  }

  if (loading) return <div className="p-6 text-sm text-gray-500">Cargando…</div>;
  if (!ticket) return <div className="p-6">Ticket no encontrado.</div>;

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <div className="text-sm text-gray-500">
            <Link href="/dashboard/soporte" className="underline">← Volver</Link>
          </div>
          <h1 className="text-2xl font-semibold mt-2">
            {ticket.subject}
          </h1>
          <div className="text-xs text-gray-500 mt-1">
            {ticket.code} · Creado {new Date(ticket.created_at).toLocaleString("es-CL")}
          </div>
        </div>
        <span className="text-xs px-3 py-1 rounded-full border bg-white">
          {statusLabel(ticket.status)}
        </span>
      </div>

      <div className="rounded-2xl border bg-white p-4">
        <div className="space-y-3">
          {messages.map(m => {
            const isUser = m.sender_role === "user";
            const atts = attachmentsByMessage.get(m.id) ?? [];
            return (
              <div key={m.id} className={`flex ${isUser ? "justify-start" : "justify-end"}`}>
                <div className={`max-w-[80%] rounded-2xl border p-3 ${isUser ? "bg-gray-50" : "bg-white"}`}>
                  <div className="text-xs text-gray-500 mb-1 flex items-center justify-between gap-3">
                    <span className="font-medium">{isUser ? "Tú" : "TixSwap (Admin)"}</span>
                    <span>{new Date(m.created_at).toLocaleString("es-CL")}</span>
                  </div>

                  {m.body ? <div className="text-sm whitespace-pre-wrap">{m.body}</div> : null}

                  {atts.length > 0 ? (
                    <div className="mt-2 space-y-1">
                      {atts.map(a => (
                        <div key={a.id} className="text-xs">
                          📎 <span className="font-medium">{a.filename}</span>
                          <span className="text-gray-500"> ({Math.round((a.size_bytes ?? 0) / 1024)} KB)</span>
                          {/* Si tu bucket es público, acá puedes armar la URL pública.
                              Si es privado, hacemos signed URLs con un endpoint. */}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        <div className="border-t mt-4 pt-4">
          {!chatEnabled ? (
            <div className="text-sm text-gray-500">
              Este ticket está <b>{statusLabel(ticket.status)}</b>. El chat está cerrado (solo lectura).
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-2">
                <div className="font-medium">Responder</div>
                <label className="text-sm underline cursor-pointer">
                  Adjuntar
                  <input
                    type="file"
                    className="hidden"
                    multiple
                    onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
                  />
                </label>
              </div>

              {files.length > 0 ? (
                <div className="text-xs text-gray-600 mb-2">
                  Adjuntos: {files.map(f => f.name).join(", ")}
                </div>
              ) : null}

              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Escribe tu respuesta…"
                className="w-full min-h-[110px] rounded-2xl border p-3 outline-none"
              />

              <div className="flex justify-end mt-3">
                <button
                  onClick={send}
                  disabled={sending}
                  className="px-5 py-2 rounded-xl bg-black text-white disabled:opacity-60"
                >
                  {sending ? "Enviando…" : "Enviar"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
