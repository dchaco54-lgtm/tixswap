// app/events/[id]/TicketCard.tsx
"use client";

import Link from "next/link";

function formatCLP(n: number) {
  try {
    return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP" }).format(n);
  } catch {
    return `$${n}`;
  }
}

export default function TicketCard({ ticket, event, seller, sellerTrust }: any) {
  const basePrice = Number(ticket?.price || 0);

  const sellerName =
    seller?.display_name ||
    sellerTrust?.sellerName ||
    (seller?.id ? `Vendedor ${String(seller.id).slice(0, 6)}` : "Vendedor");

  const avatarUrl = seller?.avatar_url || sellerTrust?.avatarUrl || null;

  const sales = Number(sellerTrust?.salesCount || 0);
  const disputes = Number(sellerTrust?.disputesCount || 0);

  return (
    <div className="border rounded-xl p-4 bg-white shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm text-gray-500">{event?.venue}</div>
          <div className="font-semibold text-lg">
            Sección {ticket?.section || "-"} • Fila {ticket?.row || "-"} • Asiento {ticket?.seat || "-"}
          </div>
        </div>

        <div className="text-right">
          <div className="text-xs text-gray-500">Precio base</div>
          <div className="text-2xl font-bold">{formatCLP(basePrice)}</div>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-gray-200 overflow-hidden flex items-center justify-center">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt={sellerName} className="h-9 w-9 object-cover" />
            ) : (
              <span className="text-xs text-gray-600">TS</span>
            )}
          </div>

          <div>
            <div className="text-sm font-medium">{sellerName}</div>
            <div className="text-xs text-gray-500">
              {sales > 0 ? `${sales} ventas` : "Aún sin ventas"} • {disputes > 0 ? `${disputes} disputas` : "Sin disputas"}
            </div>
          </div>
        </div>

        <Link
          href={`/checkout/${ticket.id}`}
          className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700"
        >
          Comprar
        </Link>
      </div>
    </div>
  );
}
