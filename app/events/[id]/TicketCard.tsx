"use client";

import Link from "next/link";

function formatCLP(value: number | null) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "";
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(n);
}

interface TicketCardProps {
  ticket: any;
  seller?: any;
}

export default function TicketCard({ ticket, seller }: TicketCardProps) {

  const price = ticket.price || ticket.price_clp || ticket.amount || null;
  const section = ticket.section || ticket.sector || "";
  const row = ticket.row || ticket.row_label || ticket.fila || "";
  const seat = ticket.seat || ticket.seat_label || ticket.asiento || "";
  const sellerName = seller?.full_name || seller?.email || "Vendedor";

  return (
    <div className="p-5 rounded-2xl border bg-white hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-lg font-semibold">
            {section ? `Sección ${section}` : "Entrada"}
          </div>
          <div className="text-gray-600 mt-1">
            {[row && `Fila ${row}`, seat && `Asiento ${seat}`].filter(Boolean).join(" · ")}
          </div>
          <div className="text-gray-600 mt-2">Vende: {sellerName}</div>
        </div>

        <div className="text-right">
          <div className="text-xl font-bold">{price ? formatCLP(price) : "-"}</div>
          <Link
            href={`/checkout/${ticket.id}`}
            className="inline-block mt-3 px-4 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-colors"
          >
            Comprar
          </Link>
        </div>
      </div>
    </div>
  );
}
