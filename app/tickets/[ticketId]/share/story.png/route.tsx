import { ImageResponse } from "next/og";
import {
  ShareFallbackImage,
  ShareImage,
  getNoStoreImageHeaders,
  getShareImageSize,
  loadRemoteImageDataUrl,
} from "@/lib/share/image";
import { getEventDisplayName, getEventImageUrl } from "@/lib/share";
import { getShareableTicket } from "@/lib/share/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request, { params }: { params: { ticketId: string } }) {
  const ticket = await getShareableTicket(params.ticketId);

  if (!ticket?.event) {
    return new Response("Not found", { status: 404 });
  }

  const url = new URL(request.url);
  const version = url.searchParams.get("v");
  const debugLabel = version ? `v=${version}` : "v2";
  const size = getShareImageSize("story");
  const eventName = getEventDisplayName(ticket.event);

  try {
    const backgroundSrc = await loadRemoteImageDataUrl(getEventImageUrl(ticket.event));

    return new ImageResponse(
      (
        <ShareImage
          kind="ticket"
          variant="story"
          eventName={eventName}
          eventDate={ticket.event?.starts_at || null}
          venue={ticket.event?.venue || null}
          city={ticket.event?.city || null}
          ticket={ticket}
          backgroundSrc={backgroundSrc}
          debugLabel={debugLabel}
        />
      ),
      {
        ...size,
        headers: getNoStoreImageHeaders(),
      }
    );
  } catch (error) {
    console.error("[share/story:ticket] render error", {
      requestId: params.ticketId,
      error: error instanceof Error ? error.stack || error.message : String(error),
    });

    return new ImageResponse(
      (
        <ShareFallbackImage
          kind="ticket"
          eventName={eventName}
          eventDate={ticket.event?.starts_at || null}
          venue={ticket.event?.venue || null}
          city={ticket.event?.city || null}
          ticket={ticket}
          debugLabel={debugLabel}
        />
      ),
      {
        ...size,
        headers: getNoStoreImageHeaders(),
      }
    );
  }
}
