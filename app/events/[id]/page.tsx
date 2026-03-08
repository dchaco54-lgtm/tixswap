import { notFound } from "next/navigation";
import EventDetailClient from "./EventDetailClient";
import {
  buildEventMetadataDescription,
  buildTicketMetadataDescription,
  ensureAbsoluteUrl,
  getEventDisplayName,
} from "@/lib/share";
import { getEventById, getEventPageData, getShareableTicket } from "@/lib/share/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

type PageProps = {
  params: { id: string };
  searchParams?: { ticket?: string };
};

const siteUrl = "https://www.tixswap.cl";

export async function generateMetadata({ params, searchParams }: PageProps) {
  const event = await getEventById(params.id);

  if (!event) {
    return {
      metadataBase: new URL(siteUrl),
      title: "Evento no disponible | TixSwap",
      description: "Este evento no está disponible.",
      robots: { index: false, follow: false },
    };
  }

  const eventName = getEventDisplayName(event);
  const sharedTicketId = typeof searchParams?.ticket === "string" ? searchParams.ticket : "";
  const cleanEventUrl = `${siteUrl}/events/${encodeURIComponent(params.id)}`;

  let title = `${eventName} | TixSwap`;
  let description = buildEventMetadataDescription({
    eventDate: event?.starts_at || null,
    venue: event?.venue || null,
    city: event?.city || null,
  });
  let canonical = cleanEventUrl;
  let image = ensureAbsoluteUrl(`/events/${params.id}/share/og.png`);

  if (sharedTicketId) {
    const ticket = await getShareableTicket(sharedTicketId);
    const belongsToEvent =
      ticket && String(ticket.event_id || ticket.event?.id || "") === String(params.id);

    if (belongsToEvent) {
      title = `Entrada para ${eventName} | TixSwap`;
      description = buildTicketMetadataDescription(ticket);
      canonical = `${cleanEventUrl}?ticket=${encodeURIComponent(sharedTicketId)}`;
      image = ensureAbsoluteUrl(`/tickets/${sharedTicketId}/share/og.png`);
    }
  }

  return {
    metadataBase: new URL(siteUrl),
    title,
    description,
    alternates: {
      canonical,
    },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: "TixSwap",
      type: "website",
      images: [{ url: image }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}

export default async function EventDetailPage({ params }: PageProps) {
  const data = await getEventPageData(params.id);

  if (!data?.event) {
    notFound();
  }

  return (
    <EventDetailClient
      eventId={params.id}
      initialEvent={data.event}
      initialTickets={data.tickets}
      initialChangeLogs={data.logs}
      initialHasRecentChange={data.hasRecent}
    />
  );
}
