"use client";

import Link from "next/link";
import TrustBadges from "@/components/TrustBadges";
import StarRating from "@/components/StarRating";

function formatCLP(value: number | null) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "";
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(n);
}

type TicketLike = {
  id: string;
  price?: number | null;
  price_clp?: number | null;
  amount?: number | null;
  sector?: string | null;
  section?: string | null;
  section_label?: string | null;
  row_label?: string | null;
  row?: string | null;
  fila?: string | null;
  seat_label?: string | null;
  seat?: string | null;
  asiento?: string | null;
  seller_id?: string | null;
  seller_name?: string | null;
};

type SellerLike = {
  full_name?: string | null;
  email?: string | null;
};

type TrustSignalsLike = {
  ratingCount?: number;
  avgRating?: number | null;
};

interface TicketCardProps {
  ticket: TicketLike;
  seller?: SellerLike | null;
  trustSignals?: TrustSignalsLike | null;
}

export default function TicketCard({ ticket, seller, trustSignals }: TicketCardProps) {

  const price = ticket.price || ticket.price_clp || ticket.amount || null;
  const section = ticket.section || ticket.sector || "";
  const row = ticket.row || ticket.row_label || ticket.fila || "";
  const seat = ticket.seat || ticket.seat_label || ticket.asiento || "";
  const sellerName = seller?.full_name || seller?.email || ticket.seller_name || "Vendedor";

  return (
    <div className="p-5 rounded-2xl border bg-white hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="text-lg font-semibold">
            {section ? `Sección ${section}` : "Entrada"}
          </div>
          <div className="text-gray-600 mt-1">
            {[row && `Fila ${row}`, seat && `Asiento ${seat}`].filter(Boolean).join(" · ")}
          </div>
          <div className="text-gray-600 mt-2">Vende: {sellerName}</div>
          
          {/* Trust badges del vendedor */}
          {trustSignals && (
            <div className="mt-2">
              <TrustBadges trustSignals={trustSignals} compact />
            </div>
          )}

          {trustSignals ? (
            trustSignals.ratingCount > 0 ? (
              <div className="mt-2">
                <StarRating
                  value={Number(trustSignals.avgRating || 0)}
                  text={`${Number(trustSignals.avgRating || 0).toFixed(1)} (${trustSignals.ratingCount})`}
                  size={14}
                />
              </div>
            ) : (
              <div className="mt-2 text-xs text-slate-500">Sin calificaciones</div>
            )
          ) : null}
          
          {/* Microcopy de confianza */}
          <div className="mt-3 text-xs text-gray-500">
            🔒 Compra protegida • 📋 Disputas con evidencia
          </div>
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
