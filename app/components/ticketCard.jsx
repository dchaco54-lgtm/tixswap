"use client";

import React from "react";
import { formatCLP } from "@/lib/format";

// OJO: Este archivo existe para que el import "@/components/ticketCard"
// funcione en Vercel/Linux (case-sensitive) y no rompa el build.

function safeText(v, fallback = "—") {
  const s = (v ?? "").toString().trim();
  return s.length ? s : fallback;
}

export default function TicketCard({
  ticket,
  onBuy,
  loading = false,
  hideBuy = false,
  className = "",
}) {
  const price = ticket?.price ?? ticket?.ticket_price ?? ticket?.amount ?? 0;

  const location =
    ticket?.location ??
    ticket?.ubication ??
    ticket?.ubicacion ??
    ticket?.seat ??
    "";

  const section = ticket?.section ?? ticket?.sector ?? ticket?.seccion ?? "";
  const row = ticket?.row ?? ticket?.fila ?? "";
  const seat = ticket?.seat ?? "";

  const seller =
    ticket?.seller_name ??
    ticket?.seller ??
    ticket?.vendor_name ??
    ticket?.seller_display ??
    "";

  const isNewSeller = Boolean(ticket?.is_new_seller ?? ticket?.isNewSeller);

  return (
    <div
      className={[
        "w-full bg-white border border-gray-200 rounded-2xl shadow-sm p-5",
        "flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4",
        className,
      ].join(" ")}
    >
      <div className="min-w-0">
        <div className="text-2xl font-semibold text-gray-900">
          {formatCLP(price)}
        </div>

        <div className="mt-1 text-sm text-gray-600">
          Ubicación: {safeText(location)}
          {section ? ` · Sector: ${section}` : ""}
          {row ? ` · Fila: ${row}` : ""}
          {seat ? ` · Asiento: ${seat}` : ""}
        </div>

        {seller ? (
          <div className="mt-2 text-sm text-gray-600">
            Vendedor:{" "}
            <span className="font-medium text-gray-900">{seller}</span>
          </div>
        ) : null}
      </div>

      <div className="flex items-center gap-3">
        {isNewSeller ? (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            🆕 Vendedor nuevo
          </span>
        ) : null}

        {!hideBuy ? (
          <button
            type="button"
            onClick={() => onBuy?.(ticket)}
            disabled={loading}
            className="inline-flex items-center justify-center rounded-xl px-6 py-3 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition"
          >
            {loading ? "Procesando..." : "Comprar"}
          </button>
        ) : null}
      </div>
    </div>
  );
}
