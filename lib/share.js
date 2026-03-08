const PUBLIC_SITE_URL = "https://www.tixswap.cl";

function cleanPath(value = "") {
  if (!value) return "";
  return value.startsWith("/") ? value : `/${value}`;
}

export function getPublicSiteUrl() {
  return PUBLIC_SITE_URL;
}

export function ensureAbsoluteUrl(value) {
  if (!value) return `${PUBLIC_SITE_URL}/og-default.png`;
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  return `${PUBLIC_SITE_URL}${cleanPath(value)}`;
}

export function getEventDisplayName(event) {
  return event?.title || event?.name || "Evento";
}

export function getEventImageUrl(event) {
  return event?.image_url || event?.poster_url || event?.cover_image || "";
}

export function buildEventLocationLine(venue, city) {
  return [venue, city].filter(Boolean).join(", ");
}

export function formatEventDateLabel(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("es-CL", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

export function formatEventTimeLabel(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("es-CL", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatEventDateTimeLine(value) {
  return [formatEventDateLabel(value), formatEventTimeLabel(value)]
    .filter(Boolean)
    .join(" · ");
}

export function buildEventMetadataDescription({ eventDate, venue, city }) {
  const dateLine = formatEventDateTimeLine(eventDate);
  const placeLine = buildEventLocationLine(venue, city);
  const prefix = [dateLine, placeLine].filter(Boolean).join(" · ");
  if (!prefix) return "Reventa segura en TixSwap.";
  return `${prefix}. Reventa segura en TixSwap.`;
}

export function formatCLP(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "";
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function getTicketPrice(ticket) {
  const amount =
    ticket?.price ??
    ticket?.price_clp ??
    ticket?.amount ??
    ticket?.amount_clp ??
    null;
  return Number.isFinite(Number(amount)) ? Number(amount) : null;
}

export function buildTicketSeatLabel(ticket) {
  const section = ticket?.section || ticket?.sector || ticket?.section_label || "";
  const row = ticket?.row || ticket?.row_label || ticket?.fila || "";
  const seat = ticket?.seat || ticket?.seat_label || ticket?.asiento || "";
  return [
    section && `Sector ${section}`,
    row && `Fila ${row}`,
    seat && `Asiento ${seat}`,
  ]
    .filter(Boolean)
    .join(" · ");
}

export function buildEventShareUrl(eventId) {
  return `${PUBLIC_SITE_URL}/events/${encodeURIComponent(
    String(eventId || "")
  )}?utm_source=share&utm_medium=social&utm_campaign=event`;
}

export function buildTicketShareUrl(eventId, ticketId) {
  const eventPath = `/events/${encodeURIComponent(String(eventId || ""))}`;
  const query = new URLSearchParams({
    ticket: String(ticketId || ""),
    utm_source: "share",
    utm_medium: "social",
    utm_campaign: "ticket",
  });
  return `${PUBLIC_SITE_URL}${eventPath}?${query.toString()}`;
}

export function buildEventStoryImageUrl(eventId) {
  return ensureAbsoluteUrl(`/events/${encodeURIComponent(String(eventId || ""))}/share/story.png`);
}

export function buildEventPostImageUrl(eventId) {
  return ensureAbsoluteUrl(`/events/${encodeURIComponent(String(eventId || ""))}/share/post.png`);
}

export function buildTicketStoryImageUrl(ticketId) {
  return ensureAbsoluteUrl(`/tickets/${encodeURIComponent(String(ticketId || ""))}/share/story.png`);
}

export function buildTicketPostImageUrl(ticketId) {
  return ensureAbsoluteUrl(`/tickets/${encodeURIComponent(String(ticketId || ""))}/share/post.png`);
}

export function buildEventShareText({ eventName, link }) {
  return `Hay entradas disponibles para ${eventName || "este evento"} 🎟️
Reventa segura en TixSwap 👇
${link || ""}`.trim();
}

export function buildTicketShareText({ eventName, ticketPrice, link }) {
  const priceLabel = formatCLP(ticketPrice);
  return `Vendo entrada para ${eventName || "este evento"} 🎸
Precio: ${priceLabel || "A convenir"}
Compra protegida en TixSwap 👇
${link || ""}`.trim();
}

export function buildTicketMetadataDescription(ticket) {
  const priceLabel = formatCLP(getTicketPrice(ticket));
  const seatLabel = buildTicketSeatLabel(ticket);
  return [priceLabel && `Precio: ${priceLabel}`, seatLabel, "Compra protegida en TixSwap."]
    .filter(Boolean)
    .join(" · ");
}
