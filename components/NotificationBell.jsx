"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function NotificationBell({ userId }) {
  const router = useRouter();
  const [count, setCount] = useState(0);

  const loadCount = useCallback(async () => {
    if (!userId) {
      setCount(0);
      return;
    }

    try {
      const res = await fetch("/api/notifications/unread-count", {
        cache: "no-store",
        credentials: "include",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "No se pudo cargar");
      setCount(Number(json?.count || 0));
    } catch {
      setCount(0);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    loadCount();

    const t = window.setInterval(() => {
      loadCount();
    }, 60000);

    return () => window.clearInterval(t);
  }, [userId, loadCount]);

  if (!userId) return null;

  const hasUnread = count > 0;
  const badgeText = count > 9 ? "9+" : String(count || "");

  return (
    <button
      type="button"
      onClick={() => router.push("/dashboard/notificaciones")}
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
