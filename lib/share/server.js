import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  buildTicketSelect,
  detectEventColumns,
  detectTicketColumns,
  normalizeTicket,
} from "@/lib/db/ticketSchema";

const RECENT_DAYS = 14;

async function getSellerValidadoMap(admin, tickets) {
  const sellerIds = [
    ...new Set((tickets || []).map((ticket) => ticket?.seller_id).filter(Boolean)),
  ];

  if (sellerIds.length === 0) return new Map();

  const { data, error } = await admin
    .from("profiles")
    .select("id, validado")
    .in("id", sellerIds);

  if (error || !Array.isArray(data)) {
    return new Map();
  }

  return new Map(data.map((profile) => [profile.id, profile.validado === true]));
}

function normalizePublicTicket(ticket) {
  return {
    id: ticket.id,
    event_id: ticket.event_id || null,
    seller_id: ticket.seller_id || null,
    seller_name: ticket.seller_name || null,
    seller_validado: ticket.seller_validado === true,
    price: ticket.price ?? null,
    currency: ticket.currency || "CLP",
    section: ticket.section_label || ticket.sector || ticket.section || null,
    row: ticket.row_label || ticket.row || null,
    seat: ticket.seat_label || ticket.seat || null,
    status: ticket.status || null,
    created_at: ticket.created_at || null,
    title: ticket.title || null,
    sale_type: ticket.sale_type || null,
    file_url: null,
    is_named: false,
    is_nominated: false,
  };
}

function isMissingRelationError(error) {
  const code = String(error?.code || "");
  const message = String(error?.message || "").toLowerCase();
  return (
    code === "PGRST204" ||
    (message.includes("tickets_public") && message.includes("schema cache"))
  );
}

export async function getEventById(eventId) {
  if (!eventId) return null;
  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("events")
    .select("*")
    .eq("id", eventId)
    .maybeSingle();

  if (error) {
    console.error("[share] getEventById error:", error);
    return null;
  }

  return data || null;
}

export async function getEventTickets(eventId) {
  if (!eventId) return [];
  const admin = supabaseAdmin();

  const { data: publicTickets, error: publicError } = await admin
    .from("tickets_public")
    .select(
      "id, event_id, seller_id, seller_name, status, price, currency, sector, row_label, seat_label, section_label, created_at, title, sale_type"
    )
    .eq("event_id", eventId)
    .in("status", ["active", "available"])
    .order("created_at", { ascending: false });

  if (!publicError) {
    const sellerValidadoMap = await getSellerValidadoMap(admin, publicTickets || []);

    return (publicTickets || []).map((ticket) =>
      normalizePublicTicket({
        ...ticket,
        seller_validado: sellerValidadoMap.get(ticket.seller_id) ?? false,
      })
    );
  }

  if (!isMissingRelationError(publicError)) {
    console.error("[share] getEventTickets public error:", publicError);
    return [];
  }

  const columns = await detectTicketColumns(admin);
  const eventColumns = await detectEventColumns(admin);
  const select = buildTicketSelect(columns, eventColumns);

  const { data: tickets, error } = await admin
    .from("tickets")
    .select(select)
    .eq("event_id", eventId)
    .in("status", ["active", "available"])
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[share] getEventTickets fallback error:", error);
    return [];
  }

  const sellerValidadoMap = await getSellerValidadoMap(admin, tickets || []);

  return (tickets || []).map((ticket) => ({
    ...normalizeTicket(ticket),
    seller_id: ticket.seller_id || null,
    seller_name: ticket.seller_name || null,
    seller_validado: sellerValidadoMap.get(ticket.seller_id) ?? false,
  }));
}

export async function getEventChanges(eventId) {
  if (!eventId) return { logs: [], hasRecent: false };
  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("event_change_logs")
    .select(
      "id, event_id, change_type, change_type_detail, message_to_users, old_values, new_values, changed_fields, created_at"
    )
    .eq("event_id", eventId)
    .order("created_at", { ascending: false })
    .limit(5);

  if (error) {
    console.error("[share] getEventChanges error:", error);
    return { logs: [], hasRecent: false };
  }

  const logs = Array.isArray(data) ? data : [];
  const latest = logs[0] || null;
  let hasRecent = false;

  if (latest?.created_at) {
    const latestTime = new Date(latest.created_at).getTime();
    if (Number.isFinite(latestTime)) {
      hasRecent = Date.now() - latestTime <= RECENT_DAYS * 24 * 60 * 60 * 1000;
    }
  }

  return { logs, hasRecent };
}

export async function getEventPageData(eventId) {
  const [event, tickets, changes] = await Promise.all([
    getEventById(eventId),
    getEventTickets(eventId),
    getEventChanges(eventId),
  ]);

  return {
    event,
    tickets,
    logs: changes.logs,
    hasRecent: changes.hasRecent,
  };
}

export async function getShareableTicket(ticketId) {
  if (!ticketId) return null;
  const admin = supabaseAdmin();
  const columns = await detectTicketColumns(admin);
  const eventColumns = await detectEventColumns(admin);
  const select = buildTicketSelect(columns, eventColumns);

  const { data, error } = await admin
    .from("tickets")
    .select(select)
    .eq("id", ticketId)
    .maybeSingle();

  if (error || !data) {
    if (error) console.error("[share] getShareableTicket error:", error);
    return null;
  }

  const normalized = normalizeTicket(data);
  const status = String(normalized.status || "").toLowerCase();
  if (!["active", "available"].includes(status)) {
    return null;
  }

  return {
    ...normalized,
    event_id: data.event_id || data.event?.id || normalized.event?.id || null,
  };
}
