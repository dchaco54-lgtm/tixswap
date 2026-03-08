import { ImageResponse } from "next/og";
import { ShareImage, getShareImageSize } from "@/lib/share/image";
import { getEventDisplayName } from "@/lib/share";
import { getShareableTicket } from "@/lib/share/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(_request: Request, { params }: { params: { ticketId: string } }) {
  const ticket = await getShareableTicket(params.ticketId);

  if (!ticket?.event) {
    return new Response("Not found", { status: 404 });
  }

  const size = getShareImageSize("story");

  return new ImageResponse(
    (
      <ShareImage
        kind="ticket"
        variant="story"
        eventName={getEventDisplayName(ticket.event)}
        eventDate={ticket.event?.starts_at || null}
        venue={ticket.event?.venue || null}
        city={ticket.event?.city || null}
        ticket={ticket}
      />
    ),
    size
  );
}
