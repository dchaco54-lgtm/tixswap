"use client";

import Link from "next/link";
import TrustBadges from "@/components/TrustBadges";
import StarRating from "@/components/StarRating";
import ShareButton from "@/components/ShareButton";
import ValidatedBadge from "@/components/ValidatedBadge";

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
  seller_validado?: boolean | null;
};

type SellerLike = {
  full_name?: string | null;
  email?: string | null;
};

type TrustSignalsLike = {
  ratingCount?: number;
  avgRating?: number | null;
};

type EventLike = {
  id?: string | null;
  title?: string | null;
  name?: string | null;
  starts_at?: string | null;
  venue?: string | null;
  city?: string | null;
  image_url?: string | null;
  poster_url?: string | null;
  cover_image?: string | null;
};

interface TicketCardProps {
  ticket: TicketLike;
  seller?: SellerLike | null;
  trustSignals?: TrustSignalsLike | null;
  event?: EventLike | null;
  highlighted?: boolean;
  sharedBadge?: boolean;
  domId?: string;
}

export default function TicketCard({
  ticket,
  seller,
  trustSignals,
  event = null,
  highlighted = false,
  sharedBadge = false,
  domId,
}: TicketCardProps) {
  const price = ticket.price || ticket.price_clp || ticket.amount || null;
  const section = ticket.section || ticket.sector || "";
  const row = ticket.row || ticket.row_label || ticket.fila || "";
  const seat = ticket.seat || ticket.seat_label || ticket.asiento || "";
  const sellerName = seller?.full_name || seller?.email || ticket.seller_name || "Vendedor";
  const eventName = event?.title || event?.name || "Evento";
  const eventImageUrl = event?.image_url || event?.poster_url || event?.cover_image || null;
  const cardClassName = highlighted
    ? "p-5 rounded-2xl border border-blue-400 bg-white shadow-[0_0_0_4px_rgba(37,99,235,0.12),0_18px_44px_rgba(37,99,235,0.18)] transition-all duration-300"
    : "p-5 rounded-2xl border bg-white hover:shadow-md transition-shadow";

  return (
    <div id={domId} className={cardClassName}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-lg font-semibold">{section ? `Sección ${section}` : "Entrada"}</div>
            {sharedBadge ? (
              <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                Entrada compartida
              </span>
            ) : null}
            {event?.id ? (
              <ShareButton
                type="ticket"
                eventId={event.id}
                eventName={eventName}
                eventDate={event?.starts_at || null}
                venue={event?.venue || null}
                city={event?.city || null}
                eventImageUrl={eventImageUrl}
                ticketId={ticket.id}
                ticketPrice={price}
                sector={section}
                row_label={row}
                seat_label={seat}
                buttonText="Compartir entrada"
                className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-white"
              />
            ) : null}
          </div>
          <div className="text-gray-600 mt-1">
            {[row && `Fila ${row}`, seat && `Asiento ${seat}`].filter(Boolean).join(" · ")}
          </div>
          <div className="text-gray-600 mt-2">Vende: {sellerName}</div>
          {ticket.seller_validado ? (
            <div className="mt-2">
              <ValidatedBadge verified={ticket.seller_validado} />
            </div>
          ) : null}
          
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
