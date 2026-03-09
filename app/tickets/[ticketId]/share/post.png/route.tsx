import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createShareFallbackResponse, createShareImageResponse } from "@/lib/share/storyImage";
import { buildTicketSeatLabel, getEventDisplayName, getEventImageUrl } from "@/lib/share";

export const runtime = "edge";
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: { ticketId: string } }) {
  try {
    void new URL(request.url).searchParams.get("v");
    const admin = supabaseAdmin();
    const { data: ticket, error } = await admin
      .from("tickets")
      .select("id,event_id,price,sector,row_label,seat_label,status")
      .eq("id", params.ticketId)
      .maybeSingle();

    if (error) throw error;
    if (!ticket?.event_id) return createShareFallbackResponse("post", "ticket", "Entrada");

    const { data: event, error: eventError } = await admin
      .from("events")
      .select("id,title,starts_at,venue,city,image_url")
      .eq("id", ticket.event_id)
      .maybeSingle();

    if (eventError) throw eventError;

    const status = String(ticket?.status || "").toLowerCase();
    if (!event || (status && !["active", "available"].includes(status))) {
      return createShareFallbackResponse("post", "ticket", "Entrada");
    }

    return createShareImageResponse({
      variant: "post",
      kind: "ticket",
      title: getEventDisplayName(event),
      eventDate: event?.starts_at || null,
      venue: event?.venue || null,
      city: event?.city || null,
      imageUrl: getEventImageUrl(event) || null,
      price: Number(ticket?.price ?? null),
      seatLabel: buildTicketSeatLabel(ticket),
    });
  } catch (error) {
    console.error("[share/post:ticket] render error", {
      requestId: params.ticketId,
      error: error instanceof Error ? error.stack || error.message : String(error),
    });
    return createShareFallbackResponse("post", "ticket", "Entrada");
  }
}
