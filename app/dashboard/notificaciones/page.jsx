"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const PAGE_SIZE = 20;

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

export default function NotificationsPage() {
  const router = useRouter();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");

  const loadPage = useCallback(async (offset = 0, append = false) => {
    try {
      if (!append) setLoading(true);
      setError("");

      const res = await fetch(
        `/api/notifications?limit=${PAGE_SIZE}&offset=${offset}`,
        { cache: "no-store", credentials: "include" }
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "No se pudieron cargar");

      const list = json?.notifications || [];
      setItems((prev) => (append ? [...prev, ...list] : list));
    } catch {
      setError("No se pudieron actualizar");
      if (!append) setItems([]);
    } finally {
      if (!append) setLoading(false);
      if (append) setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    loadPage(0, false);
  }, [loadPage]);

  const markAllRead = async () => {
    try {
      const res = await fetch("/api/notifications/mark-all-read", {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error();
      setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
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
      setItems((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
    } catch {
      // noop
    }
  };

  const handleItemClick = async (n) => {
    if (!n?.is_read) {
      await markOneRead(n.id);
    }
    if (n?.link) {
      router.push(n.link);
    }
  };

  const empty = useMemo(
    () => !loading && !error && items.length === 0,
    [loading, error, items]
  );

  const hasMore = items.length > 0 && items.length % PAGE_SIZE === 0;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Notificaciones</h1>
          <p className="text-sm text-slate-500">
            Últimas actividades importantes de tu cuenta.
          </p>
        </div>
        <button
          onClick={markAllRead}
          className="rounded-lg border px-4 py-2 text-sm hover:bg-slate-50"
        >
          Marcar todas como leídas
        </button>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 text-red-700 p-4 mb-4 flex items-center justify-between gap-3">
          <span>{error}</span>
          <button
            onClick={() => loadPage(0, false)}
            className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs text-red-700 hover:bg-red-50"
          >
            Reintentar
          </button>
        </div>
      ) : null}

      {loading ? (
        <div className="grid gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-20 rounded-2xl border animate-pulse" />
          ))}
        </div>
      ) : null}

      {empty ? (
        <div className="rounded-2xl border p-6 text-slate-600">
          No tienes notificaciones.
        </div>
      ) : null}

      <div className="grid gap-3">
        {items.map((n) => {
          const unread = !n.is_read;
          return (
            <button
              key={n.id}
              type="button"
              onClick={() => handleItemClick(n)}
              className={`w-full text-left rounded-2xl border bg-white p-4 shadow-sm transition hover:bg-slate-50 ${
                unread ? "border-blue-200" : "border-slate-200"
              }`}
            >
              <div className="flex items-start gap-3">
                <span
                  className={`mt-1 h-2.5 w-2.5 rounded-full ${
                    unread ? "bg-blue-500" : "bg-slate-200"
                  }`}
                />
                <div className="flex-1">
                  <div className={`text-sm ${unread ? "font-semibold" : "font-medium"} text-slate-900`}>
                    {n.title}
                  </div>
                  {n.body ? (
                    <div className="text-xs text-slate-600 mt-1">
                      {n.body}
                    </div>
                  ) : null}
                  <div className="text-xs text-slate-400 mt-2">
                    {formatRelative(n.created_at)}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {hasMore ? (
        <div className="mt-6 flex justify-center">
          <button
            onClick={() => {
              setLoadingMore(true);
              loadPage(items.length, true);
            }}
            className="rounded-lg border px-4 py-2 text-sm hover:bg-slate-50"
            disabled={loadingMore}
          >
            {loadingMore ? "Cargando..." : "Cargar más"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
