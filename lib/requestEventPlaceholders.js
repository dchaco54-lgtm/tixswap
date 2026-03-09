import { detectEventColumns } from "@/lib/db/ticketSchema";

const HIDDEN_EVENT_STATUSES = new Set(["draft", "pending", "hidden"]);
const PLACEHOLDER_VENUE = "Pendiente de validacion";

export async function ensureRequestPlaceholderEvent(supabase, { eventId, requestedEventName }) {
  const normalizedEventId = String(eventId || "").trim() || null;
  if (normalizedEventId) {
    const { data: existing, error } = await supabase
      .from("events")
      .select("id,title,starts_at,venue,city,status")
      .eq("id", normalizedEventId)
      .maybeSingle();

    if (error) throw error;
    if (!existing) throw new Error("Evento placeholder no encontrado");
    return existing;
  }

  const title = String(requestedEventName || "").trim();
  if (!title) {
    throw new Error("Falta requestedEventName para crear placeholder");
  }

  const columns = await detectEventColumns(supabase);
  const payload = {
    title,
    starts_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    venue: PLACEHOLDER_VENUE,
    city: null,
    category: null,
    image_url: null,
  };

  if (columns.has("status")) {
    payload.status = "draft";
  }

  const { data: created, error: createErr } = await supabase
    .from("events")
    .insert(payload)
    .select("id,title,starts_at,venue,city,status")
    .single();

  if (createErr) throw createErr;
  return created;
}

export async function publishOrUpdatePlaceholderEvent(supabase, { eventId, event }) {
  const columns = await detectEventColumns(supabase);
  const payload = {
    title: String(event?.title || "").trim() || null,
    starts_at: event?.starts_at || null,
    venue: String(event?.venue || "").trim() || null,
    city: String(event?.city || "").trim() || null,
    category: String(event?.category || "").trim() || null,
    image_url: String(event?.image_url || "").trim() || null,
  };

  if (columns.has("status")) {
    payload.status = "published";
  }

  if (eventId) {
    const { data: updated, error: updateErr } = await supabase
      .from("events")
      .update(payload)
      .eq("id", eventId)
      .select("id,title")
      .single();

    if (updateErr) throw updateErr;
    return updated;
  }

  const { data: created, error: createErr } = await supabase
    .from("events")
    .insert(payload)
    .select("id,title")
    .single();

  if (createErr) throw createErr;
  return created;
}

export function isHiddenEventStatus(value) {
  return HIDDEN_EVENT_STATUSES.has(String(value || "").toLowerCase().trim());
}
