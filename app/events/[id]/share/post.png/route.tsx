import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createShareFallbackResponse, createShareImageResponse } from "@/lib/share/storyImage";
import { getEventDisplayName, getEventImageUrl } from "@/lib/share";

export const runtime = "edge";
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    void new URL(request.url).searchParams.get("v");
    const admin = supabaseAdmin();
    const { data: event, error } = await admin
      .from("events")
      .select("id,title,starts_at,venue,city,image_url")
      .eq("id", params.id)
      .maybeSingle();

    if (error) throw error;
    if (!event) return createShareFallbackResponse("post", "event", "Evento");

    return createShareImageResponse({
      variant: "post",
      kind: "event",
      title: getEventDisplayName(event),
      eventDate: event?.starts_at || null,
      venue: event?.venue || null,
      city: event?.city || null,
      imageUrl: getEventImageUrl(event) || null,
    });
  } catch (error) {
    console.error("[share/post:event] render error", {
      requestId: params.id,
      error: error instanceof Error ? error.stack || error.message : String(error),
    });
    return createShareFallbackResponse("post", "event", "Evento");
  }
}
