"use client";

import { useEffect, useState } from "react";
import StarRating from "@/components/StarRating";

export default function SellerReputation({ sellerId }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        const res = await fetch(
          `/api/sellers/reputation?sellerId=${encodeURIComponent(sellerId)}`
        );
        const json = await res.json().catch(() => null);
        if (cancelled) return;
        setData(res.ok ? json : null);
      } catch {
        if (cancelled) return;
        setData(null);
      } finally {
        if (cancelled) return;
        setLoading(false);
      }
    }

    if (sellerId) load();
    return () => {
      cancelled = true;
    };
  }, [sellerId]);

  if (!sellerId) return null;
  if (loading) return <span className="text-xs text-slate-400">Cargando…</span>;
  if (!data) return null;

  const salesCount = Number(data.sales_count ?? 0);
  const scoreNum = Number(data.score);
  const hasScore = Number.isFinite(scoreNum);

  // Si no tiene 5 ventas => vendedor nuevo
  const isNew = !hasScore || salesCount < 5;

  if (isNew) {
    return (
      <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
        <span aria-hidden>🆕</span>
        <span>Vendedor nuevo</span>
      </div>
    );
  }

  // ⭐⭐⭐⭐⭐ + “4.6 (12 ventas)”
  const text = `${scoreNum.toFixed(1)} (${salesCount} ventas)`;

  return (
    <div className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 shadow-sm">
      <StarRating value={scoreNum} text={text} size={16} />
    </div>
  );
}


