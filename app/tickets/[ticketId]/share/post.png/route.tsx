import { ImageResponse } from "next/og";
import {
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
  const size = getShareImageSize("post");
  const backgroundSrc = await loadRemoteImageDataUrl(getEventImageUrl(ticket.event));

  return new ImageResponse(
    (
      <ShareImage
        kind="ticket"
        variant="post"
        eventName={getEventDisplayName(ticket.event)}
        eventDate={ticket.event?.starts_at || null}
        venue={ticket.event?.venue || null}
        city={ticket.event?.city || null}
        ticket={ticket}
        backgroundSrc={backgroundSrc}
        debugLabel={version ? `v=${version}` : "v2"}
      />
    ),
    {
      ...size,
      headers: getNoStoreImageHeaders(),
    }
  );
}
