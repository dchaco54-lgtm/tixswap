import { ImageResponse } from "next/og";
import { ShareImage, getShareImageSize } from "@/lib/share/image";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const size = getShareImageSize("post");

  return new ImageResponse(
    (
      <ShareImage
        kind="default"
        variant="post"
        eventName="TixSwap"
        eventDate={null}
        venue="Reventa segura"
        city="Chile"
        ticket={null}
      />
    ),
    size
  );
}
