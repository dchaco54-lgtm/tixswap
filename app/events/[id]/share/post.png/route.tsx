import { ImageResponse } from "next/og";
import { ShareImage, getShareImageSize } from "@/lib/share/image";
import { getEventDisplayName } from "@/lib/share";
import { getEventById } from "@/lib/share/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const event = await getEventById(params.id);

  if (!event) {
    return new Response("Not found", { status: 404 });
  }

  const size = getShareImageSize("post");

  return new ImageResponse(
    (
      <ShareImage
        kind="event"
        variant="post"
        eventName={getEventDisplayName(event)}
        eventDate={event?.starts_at || null}
        venue={event?.venue || null}
        city={event?.city || null}
        ticket={null}
      />
    ),
    size
  );
}
