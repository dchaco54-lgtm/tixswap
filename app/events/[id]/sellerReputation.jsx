"use client";

import { useEffect, useState } from "react";

export default function SellerReputation({ sellerId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!sellerId) {
        setLoading(false);
        setData({ label: "—" });
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
      } catch (e) {
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

  if (loading) {
    return <span className="text-xs text-slate-400">Cargando…</span>;
  }

  if (!data) {
    return <span className="text-xs text-slate-400">—</span>;
  }

  const sales =
    typeof data.sales_count === "number" ? data.sales_count : null;

  return (
    <span className="inline-flex items-center gap-2">
      <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-xs font-semibold">
        ⭐ {data.label}
      </span>
      {sales !== null ? (
        <span className="text-xs text-slate-500">{sales} ventas</span>
      ) : null}
    </span>
  );
}
