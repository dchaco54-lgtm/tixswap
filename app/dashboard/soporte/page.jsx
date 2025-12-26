"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { statusLabel } from "@/lib/support/status";

export default function UserSupportPage() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/support/tickets", { cache: "no-store" });
    const json = await res.json();
    setTickets(json.tickets ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-semibold">Soporte</h1>
          <p className="text-sm text-gray-500">Tus tickets y conversaciones con TixSwap.</p>
        </div>
        <button
          onClick={load}
          className="px-4 py-2 rounded-xl border bg-white hover:bg-gray-50"
        >
          Recargar
        </button>
      </div>

      {loading ? (
        <div className="text-sm text-gray-500">Cargando…</div>
      ) : tickets.length === 0 ? (
        <div className="rounded-2xl border p-6 bg-white">
          <div className="font-medium">Aún no tienes tickets</div>
          <div className="text-sm text-gray-500 mt-1">Cuando crees uno, aparecerá acá.</div>
        </div>
      ) : (
        <div className="rounded-2xl border bg-white overflow-hidden">
          {tickets.map(t => (
            <Link
              key={t.id}
              href={`/dashboard/soporte/${t.id}`}
              className="block p-4 border-b last:border-b-0 hover:bg-gray-50"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold">{t.subject}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    {t.code} · {new Date(t.created_at).toLocaleString("es-CL")}
                  </div>
                </div>
                <span className="text-xs px-3 py-1 rounded-full border bg-white">
                  {statusLabel(t.status)}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
