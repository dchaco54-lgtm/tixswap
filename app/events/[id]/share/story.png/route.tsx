import { ImageResponse } from "next/og";
import {
  ShareFallbackImage,
  ShareImage,
  getNoStoreImageHeaders,
  getShareImageSize,
  loadRemoteImageDataUrl,
} from "@/lib/share/image";
import { getEventDisplayName, getEventImageUrl } from "@/lib/share";
import { getEventById } from "@/lib/share/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const event = await getEventById(params.id);

  if (!event) {
    return new Response("Not found", { status: 404 });
  }

  const url = new URL(request.url);
  const version = url.searchParams.get("v");
  const debugLabel = version ? `v=${version}` : "v2";
  const size = getShareImageSize("story");
  const eventName = getEventDisplayName(event);

  try {
    const backgroundSrc = await loadRemoteImageDataUrl(getEventImageUrl(event));

    return new ImageResponse(
      (
        <ShareImage
          kind="event"
          variant="story"
          eventName={eventName}
          eventDate={event?.starts_at || null}
          venue={event?.venue || null}
          city={event?.city || null}
          ticket={null}
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
    console.error("[share/story:event] render error", {
      requestId: params.id,
      error: error instanceof Error ? error.stack || error.message : String(error),
    });

    return new ImageResponse(
      (
        <ShareFallbackImage
          kind="event"
          eventName={eventName}
          eventDate={event?.starts_at || null}
          venue={event?.venue || null}
          city={event?.city || null}
          ticket={null}
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
