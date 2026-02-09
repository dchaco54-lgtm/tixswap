import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSellerTrustSignals } from "@/lib/trustSignals";
import TrustBadges from "@/components/TrustBadges";
import StarRating from "@/components/StarRating";
import TicketPublicClient from "./TicketPublicClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

type PublicTicketData = {
  ticket: any;
  event: any;
  trustSignals: any;
  recentRatings: Array<{
    id: string;
    stars: number;
    comment: string | null;
    created_at: string | null;
  }>;
  notFound?: boolean;
};

function formatDateTimeCL(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("es-CL", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function formatCLP(value: number | string | null) {
  const val = Number(value || 0);
  return `$${val.toLocaleString("es-CL")}`;
}

function formatRating(value: number | null | undefined) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "";
  return n.toFixed(1);
}

function ensureAbsoluteUrl(url: string | null | undefined, baseUrl: string) {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  if (!baseUrl) return url;
  if (url.startsWith("/")) return `${baseUrl}${url}`;
  return `${baseUrl}/${url}`;
}

function getBaseUrl() {
  const envUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL;
  if (envUrl) return envUrl.replace(/\/$/, "");
  const h = headers();
  const host = h.get("x-forwarded-host") || h.get("host");
  if (!host) return "";
  const proto = h.get("x-forwarded-proto") || "https";
  return `${proto}://${host}`;
}

function buildSeatLabel(section: string | null, row: string | null, seat: string | null) {
  const parts = [] as string[];
  const normalizePrefix = (label: string, prefix: string) => {
    const trimmed = label.trim();
    if (trimmed.toLowerCase().startsWith(prefix.toLowerCase())) return trimmed;
    return `${prefix} ${trimmed}`;
  };

  if (section) parts.push(normalizePrefix(section, "Sector"));
  if (row) parts.push(`Fila ${row}`);
  if (seat) parts.push(`Asiento ${seat}`);
  return parts.join(" · ");
}

async function getPublicTicketData(ticketId: string): Promise<PublicTicketData | null> {
  const admin = supabaseAdmin();

  const { data: ticket, error } = await admin
    .from("tickets")
    .select(
      "*, event:events(id, title, city, venue, starts_at, image_url)"
    )
    .eq("id", ticketId)
    .maybeSingle();

  if (error || !ticket) return null;

  const status = String(ticket.status || "").toLowerCase();
  if (!["active", "available"].includes(status)) {
    return { ticket, event: ticket.event || null, trustSignals: null, recentRatings: [], notFound: true };
  }

  const sellerId = ticket.seller_id || null;
  let trustSignals = null;
  try {
    trustSignals = sellerId ? await getSellerTrustSignals(sellerId) : null;
  } catch {
    trustSignals = null;
  }

  let recentRatings: PublicTicketData["recentRatings"] = [];
  if (sellerId) {
    const { data: ratings } = await admin
      .from("ratings")
      .select("id, stars, comment, created_at")
      .eq("target_id", sellerId)
      .eq("role", "buyer")
      .order("created_at", { ascending: false })
      .limit(8);

    recentRatings = (ratings || [])
      .filter((r) => String(r.comment || "").trim())
      .slice(0, 3);
  }

  return {
    ticket,
    event: ticket.event || null,
    trustSignals,
    recentRatings,
  };
}

export async function generateMetadata({ params }: { params: { ticketId: string } }) {
  const baseUrl = getBaseUrl();
  const canonical = baseUrl ? `${baseUrl}/tickets/${params.ticketId}` : undefined;

  const data = await getPublicTicketData(params.ticketId);

  if (!data || data.notFound) {
    return {
      title: "Entrada no disponible | TixSwap",
      description: "La entrada no está disponible.",
      robots: { index: false, follow: false },
      ...(canonical ? { alternates: { canonical } } : {}),
      ...(baseUrl ? { metadataBase: new URL(baseUrl) } : {}),
    };
  }

  const { ticket, event, trustSignals } = data;
  const eventTitle = event?.title || "Evento";
  const sectionRaw = ticket.section_label ?? ticket.sector ?? ticket.section ?? null;
  const rowRaw = ticket.row_label ?? ticket.row ?? null;
  const seatRaw = ticket.seat_label ?? ticket.seat ?? null;
  const section = sectionRaw != null ? String(sectionRaw) : null;
  const row = rowRaw != null ? String(rowRaw) : null;
  const seat = seatRaw != null ? String(seatRaw) : null;
  const seatLabel = buildSeatLabel(section, row, seat);

  const title = seatLabel
    ? `Entrada para ${eventTitle} | ${seatLabel}`
    : `Entrada para ${eventTitle}`;

  const priceNumber = Number(ticket.price ?? ticket.price_clp ?? 0);
  const priceLabel = priceNumber.toLocaleString("es-CL");
  const ratingCount = Number(trustSignals?.ratingCount ?? 0);
  const ratingValue = formatRating(trustSignals?.avgRating);
  const ratingLabel = ratingCount
    ? `${ratingValue || "—"}⭐ (${ratingCount} calificaciones)`
    : "Vendedor nuevo";

  const description = `${priceLabel} CLP · ${ratingLabel} · Compra segura en TixSwap`;
  const imageUrl = ensureAbsoluteUrl(event?.image_url, baseUrl);

  return {
    title,
    description,
    ...(canonical ? { alternates: { canonical } } : {}),
    ...(baseUrl ? { metadataBase: new URL(baseUrl) } : {}),
    openGraph: {
      title,
      description,
      url: canonical,
      type: "website",
      ...(imageUrl ? { images: [{ url: imageUrl }] } : {}),
    },
    twitter: {
      card: imageUrl ? "summary_large_image" : "summary",
      title,
      description,
      ...(imageUrl ? { images: [imageUrl] } : {}),
    },
  };
}

export default async function TicketPublicPage({
  params,
}: {
  params: { ticketId: string };
}) {
  const data = await getPublicTicketData(params.ticketId);

  if (!data || data.notFound) {
    notFound();
  }

  const { ticket, event, trustSignals, recentRatings } = data;
  const eventTitle = event?.title || "Evento";
  const eventDate = formatDateTimeCL(event?.starts_at || null);
  const eventPlace = [event?.venue, event?.city].filter(Boolean).join(", ");

  const sectionRaw = ticket.section_label ?? ticket.sector ?? ticket.section ?? null;
  const rowRaw = ticket.row_label ?? ticket.row ?? null;
  const seatRaw = ticket.seat_label ?? ticket.seat ?? null;
  const section = sectionRaw != null ? String(sectionRaw) : null;
  const row = rowRaw != null ? String(rowRaw) : null;
  const seat = seatRaw != null ? String(seatRaw) : null;
  const seatLabel = buildSeatLabel(section, row, seat);
  const transferType = ticket.transfer_type || ticket.transferType || null;
  const saleType = ticket.sale_type || null;

  const ratingCount = Number(trustSignals?.ratingCount ?? 0);
  const ratingValue = formatRating(trustSignals?.avgRating) || "—";

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between">
        <Link href={event?.id ? `/events/${event.id}` : "/events"} className="text-blue-600 hover:underline">
          Ver evento
        </Link>
      </div>

      <div className="mt-6 p-6 rounded-2xl border bg-white">
        {event?.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={event.image_url}
            alt={eventTitle}
            className="w-full h-56 object-cover rounded-xl mb-6"
          />
        ) : null}

        <h1 className="text-3xl font-bold text-slate-900">
          {eventTitle}
        </h1>
        {eventDate ? (
          <div className="text-slate-600 mt-2">{eventDate}</div>
        ) : null}
        {eventPlace ? (
          <div className="text-slate-600 mt-1">{eventPlace}</div>
        ) : null}
      </div>

      <div className="mt-6 p-6 rounded-2xl border bg-white">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
          <div>
            <div className="text-lg font-semibold text-slate-900">Tu entrada</div>
            <div className="text-slate-700 mt-3 space-y-1">
              {seatLabel ? <div>{seatLabel}</div> : null}
              {saleType ? (
                <div className="text-sm text-slate-600">Tipo de venta: {saleType}</div>
              ) : null}
              {transferType ? (
                <div className="text-sm text-slate-600">
                  Tipo transferencia: {transferType}
                </div>
              ) : null}
            </div>

            {ticket.description ? (
              <div className="text-sm text-slate-600 mt-4 whitespace-pre-wrap">
                {ticket.description}
              </div>
            ) : null}
          </div>

          <div className="text-right">
            <div className="text-sm text-slate-500">Precio</div>
            <div className="text-3xl font-bold text-slate-900">
              {formatCLP(ticket.price ?? ticket.price_clp ?? 0)}
            </div>
            <div className="mt-4">
              <TicketPublicClient ticketId={ticket.id} />
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 p-6 rounded-2xl border bg-white">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div>
            <div className="text-lg font-semibold text-slate-900">Vendedor</div>
            <div className="text-slate-700 mt-2">
              {trustSignals?.sellerName || "Vendedor"}
            </div>
            <div className="text-slate-600 mt-2">
              {ratingCount ? (
                <StarRating
                  value={Number(trustSignals?.avgRating || 0)}
                  text={`${ratingValue} (${ratingCount} calificaciones)`}
                  size={16}
                />
              ) : (
                "Aún sin calificaciones"
              )}
            </div>
          </div>

          <div className="flex items-start gap-2">
            <TrustBadges trustSignals={trustSignals} />
          </div>
        </div>

        {recentRatings.length > 0 ? (
          <div className="mt-5">
            <div className="text-sm font-semibold text-slate-800 mb-3">
              Últimas reseñas
            </div>
            <div className="space-y-3">
              {recentRatings.map((r) => (
                <div key={r.id} className="rounded-xl border bg-slate-50 p-3">
                  <div className="text-sm text-slate-700">
                    ⭐ {r.stars}
                  </div>
                  {r.comment ? (
                    <div className="text-sm text-slate-600 mt-1">{r.comment}</div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <div className="mt-6 rounded-2xl border-2 border-blue-100 bg-blue-50 p-5">
        <div className="flex items-start gap-3">
          <div className="flex-1">
            <div className="font-semibold text-blue-900 mb-1">
              Compra segura en TixSwap
            </div>
            <div className="text-sm text-blue-800">
              Tu pago queda en resguardo hasta que valides el acceso. Si hay problema,
              puedes abrir disputa con evidencia. Soporte incluido.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
