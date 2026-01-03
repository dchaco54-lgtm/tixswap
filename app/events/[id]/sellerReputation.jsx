"use client";

import { useEffect, useMemo, useState } from "react";

function StarIcon({ variant }) {
  // SVG path de estrella (24x24)
  const path =
    "M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z";

  if (variant === "half") {
    return (
      <span className="relative inline-block w-4 h-4">
        {/* base vacía */}
        <svg
          viewBox="0 0 24 24"
          className="w-4 h-4 text-slate-300"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path d={path} />
        </svg>

        {/* overlay llena, recortada a la mitad */}
        <svg
          viewBox="0 0 24 24"
          className="w-4 h-4 text-amber-500 absolute inset-0"
          fill="currentColor"
          stroke="currentColor"
          strokeWidth="0.5"
          style={{ clipPath: "inset(0 50% 0 0)" }}
        >
          <path d={path} />
        </svg>
      </span>
    );
  }

  if (variant === "full") {
    return (
      <svg
        viewBox="0 0 24 24"
        className="w-4 h-4 text-amber-500"
        fill="currentColor"
      >
        <path d={path} />
      </svg>
    );
  }

  // empty
  return (
    <svg
      viewBox="0 0 24 24"
      className="w-4 h-4 text-slate-300"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path d={path} />
    </svg>
  );
}

function Stars({ value }) {
  const safe = Math.max(0, Math.min(5, Number(value || 0)));
  const display = Math.round(safe * 2) / 2; // 0.5 steps
  const full = Math.floor(display);
  const half = display - full >= 0.5;
  const empty = 5 - full - (half ? 1 : 0);

  return (
    <span className="inline-flex items-center gap-1">
      <span className="inline-flex items-center gap-0.5">
        {Array.from({ length: full }).map((_, i) => (
          <StarIcon key={`f-${i}`} variant="full" />
        ))}
        {half ? <StarIcon key="h" variant="half" /> : null}
        {Array.from({ length: empty }).map((_, i) => (
          <StarIcon key={`e-${i}`} variant="empty" />
        ))}
      </span>
      <span className="text-xs text-slate-500">{display.toFixed(1)}</span>
    </span>
  );
}

export default function SellerReputation({ sellerId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      // Si no hay sellerId, no rompemos UI
      if (!sellerId) {
        setLoading(false);
        setData({ label: "Vendedor nuevo" });
        return;
      }

      try {
        const res = await fetch(
          `/api/sellers/reputation?sellerId=${encodeURIComponent(sellerId)}`,
          { cache: "no-store" }
        );
        const json = await res.json();
        if (!cancelled) {
          setData(json);
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setData({ label: "Vendedor nuevo" });
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [sellerId]);

  const sales = typeof data?.sales_count === "number" ? data.sales_count : null;
  const score = typeof data?.score === "number" ? data.score : null;

  const isNew = useMemo(() => {
    if (!data) return true;
    if (String(data?.label || "").toLowerCase().includes("vendedor nuevo")) return true;
    if (sales !== null && sales < 5) return true;
    if (score === null) return true;
    return false;
  }, [data, sales, score]);

  if (loading) {
    return (
      <span className="inline-flex items-center gap-2">
        <span className="h-6 w-28 rounded-full bg-slate-100" />
      </span>
    );
  }

  if (isNew) {
    return (
      <span className="inline-flex items-center gap-2">
        <span className="px-2 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold">
          🆕 Vendedor nuevo
        </span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-2">
      <span className="px-2 py-1 rounded-full bg-amber-50 text-amber-800 text-xs font-semibold">
        <Stars value={score} />
      </span>
      {sales !== null ? (
        <span className="text-xs text-slate-500">{sales} ventas</span>
      ) : null}
    </span>
  );
}

