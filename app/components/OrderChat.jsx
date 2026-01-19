"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

function formatTime(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString("es-CL", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export default function OrderChat({ orderId, onClose }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [error, setError] = useState("");
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  async function loadMessages() {
    try {
      setLoading(true);
      setError("");

      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) {
        setError("No autorizado");
        return;
      }

      const res = await fetch(`/api/orders/${orderId}/messages`, {
        headers: {
          Authorization: `Bearer ${session.session.access_token}`,
        },
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(json?.error || "No se pudieron cargar los mensajes");
      }

      setMessages(json.messages || []);
      setTimeout(scrollToBottom, 100);
    } catch (e) {
      console.error(e);
      setError(e.message || "Error cargando mensajes");
    } finally {
      setLoading(false);
    }
  }

  async function handleSend(e) {
    e.preventDefault();

    if (!newMessage.trim() || sending) return;

    try {
      setSending(true);
      setError("");

      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) {
        setError("No autorizado");
        return;
      }

      const res = await fetch(`/api/orders/${orderId}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.session.access_token}`,
        },
        body: JSON.stringify({ message: newMessage.trim() }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(json?.error || "No se pudo enviar el mensaje");
      }

      setNewMessage("");
      await loadMessages();
    } catch (e) {
      console.error(e);
      setError(e.message || "Error enviando mensaje");
    } finally {
      setSending(false);
    }
  }

  useEffect(() => {
    if (orderId) loadMessages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  // Prevenir scroll del body cuando el modal está abierto
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-xl flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">💬 Chat con vendedor</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading ? (
            <div className="text-center text-gray-500 py-8">Cargando mensajes...</div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
              {error}
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              Aún no hay mensajes. Inicia la conversación.
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.is_mine ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[70%] rounded-2xl px-4 py-2 ${
                    msg.is_mine
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-900"
                  }`}
                >
                  {!msg.is_mine && (
                    <div className="text-xs font-medium mb-1 opacity-80">
                      {msg.sender?.full_name || msg.sender?.email || "Usuario"}
                    </div>
                  )}
                  <div className="whitespace-pre-wrap break-words">{msg.message}</div>
                  {msg.attachment_url && (
                    <a
                      href={msg.attachment_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs underline mt-1 block"
                    >
                      📎 {msg.attachment_name || "Archivo adjunto"}
                    </a>
                  )}
                  <div className="text-xs mt-1 opacity-70">
                    {formatTime(msg.created_at)}
                  </div>
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <form onSubmit={handleSend} className="p-4 border-t">
          <div className="flex gap-2">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Escribe tu mensaje..."
              disabled={sending}
              className="flex-1 border border-gray-300 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!newMessage.trim() || sending}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sending ? "..." : "Enviar"}
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            💡 No compartas información personal sensible (claves, PIN, etc.)
          </p>
        </form>
      </div>
    </div>
  );
}
