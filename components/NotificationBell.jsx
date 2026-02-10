"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

function formatRelative(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";

  const diff = Date.now() - d.getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "Hace un momento";

  const min = Math.floor(sec / 60);
  if (min < 60) return `Hace ${min} min`;

  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `Hace ${hrs} h`;

  const days = Math.floor(hrs / 24);
  if (days < 7) return `Hace ${days} d`;

  return new Intl.DateTimeFormat("es-CL", {
    day: "2-digit",
    month: "short",
  }).format(d);
}

export default function NotificationBell({ userId }) {
  const router = useRouter();
  const rootRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const loadPreview = useCallback(
    async ({ silent = false } = {}) => {
      if (!userId) {
        setItems([]);
        setUnreadCount(0);
        return;
      }

      if (!silent) setLoading(true);
      if (!silent) setError("");

      try {
        const res = await fetch("/api/notifications/preview", {
          cache: "no-store",
          credentials: "include",
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.error || "No se pudieron cargar");
        setItems(Array.isArray(json?.items) ? json.items : []);
        setUnreadCount(Number(json?.unreadCount || 0));
      } catch {
        if (!silent) {
          setError("No se pudieron cargar");
          setItems([]);
        }
        setUnreadCount((prev) => prev || 0);
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [userId]
  );

  useEffect(() => {
    if (!userId) return;
    loadPreview({ silent: true });

    const t = window.setInterval(() => {
      loadPreview({ silent: true });
    }, 60000);

    return () => window.clearInterval(t);
  }, [userId, loadPreview]);

  useEffect(() => {
    if (!open) return;
    loadPreview();
  }, [open, loadPreview]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e) => {
      if (!rootRef.current?.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const markAllRead = async () => {
    try {
      const res = await fetch("/api/notifications/mark-all-read", {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error();
      setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch {
      setError("No se pudieron actualizar");
    }
  };

  const markOneRead = async (id) => {
    if (!id) return;
    try {
      const res = await fetch(`/api/notifications/${id}`, {
        method: "PATCH",
        credentials: "include",
      });
      if (!res.ok) throw new Error();
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch {
      // noop
    }
  };

  const handleItemClick = async (n) => {
    if (!n) return;
    if (!n.is_read) await markOneRead(n.id);
    if (n.link) {
      router.push(n.link);
      setOpen(false);
    }
  };

  if (!userId) return null;

  const hasUnread = unreadCount > 0;
  const badgeText = unreadCount > 9 ? "9+" : String(unreadCount || "");

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`relative inline-flex items-center justify-center rounded-full p-2 border transition ${
          hasUnread
            ? "text-slate-700 border-slate-200 hover:bg-slate-50"
            : "text-slate-400 border-slate-200 hover:bg-slate-50"
        }`}
        aria-label="Notificaciones"
      >
        <BellIcon active={hasUnread} />
        {hasUnread ? (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-semibold flex items-center justify-center">
            {badgeText}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 mt-2 w-80 rounded-2xl border bg-white shadow-lg z-50 overflow-hidden">
          <div className="px-4 py-3 border-b flex items-center justify-between">
            <div className="text-sm font-semibold text-slate-900">Notificaciones</div>
            {hasUnread ? (
              <button
                type="button"
                onClick={markAllRead}
                className="text-xs text-blue-600 hover:underline"
              >
                Marcar como leídas
              </button>
            ) : null}
          </div>

          <div className="max-h-96 overflow-auto">
            {loading ? (
              <div className="p-4 text-sm text-slate-500">Cargando...</div>
            ) : null}

            {error ? (
              <div className="p-4 text-sm text-slate-500">{error}</div>
            ) : null}

            {!loading && !error && items.length === 0 ? (
              <div className="p-4 text-sm text-slate-500">No tienes notificaciones.</div>
            ) : null}

            {items.map((n) => {
              const unread = !n.is_read;
              return (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => handleItemClick(n)}
                  className={`w-full text-left px-4 py-3 border-b last:border-b-0 transition ${
                    unread ? "bg-slate-50" : "bg-white"
                  } hover:bg-slate-100`}
                >
                  <div className="flex items-start gap-2">
                    {unread ? (
                      <span className="mt-1 h-2 w-2 rounded-full bg-blue-500" />
                    ) : (
                      <span className="mt-1 h-2 w-2 rounded-full bg-transparent" />
                    )}
                    <div className="flex-1">
                      <div className={`text-sm ${unread ? "font-semibold" : "font-medium"} text-slate-900`}>
                        {n.title}
                      </div>
                      {n.body ? (
                        <div className="text-xs text-slate-600 mt-0.5 line-clamp-2">
                          {n.body}
                        </div>
                      ) : null}
                      <div className="text-xs text-slate-400 mt-1">
                        {formatRelative(n.created_at)}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="px-4 py-3 border-t bg-slate-50 flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                router.push("/dashboard/notificaciones");
              }}
              className="text-sm text-blue-600 hover:underline"
            >
              Ver todas
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function BellIcon({ active }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={active ? "text-slate-700" : "text-slate-400"}
      aria-hidden
    >
      <path d="M18 8a6 6 0 10-12 0c0 7-3 7-3 7h18s-3 0-3-7" />
      <path d="M13.73 21a2 2 0 01-3.46 0" />
    </svg>
  );
}
