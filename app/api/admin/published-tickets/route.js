import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { detectEventColumns, detectTicketColumns } from "@/lib/db/ticketSchema";
import { getUserFromBearer, isAdminUser } from "@/lib/support/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const EVENT_FIELDS = [
  "id",
  "title",
  "starts_at",
  "venue",
  "city",
];

function buildEventSelect(eventColumns) {
  const cols = eventColumns instanceof Set ? eventColumns : new Set();
  const parts = EVENT_FIELDS.filter((field) => cols.has(field));
  return parts.length ? parts.join(",") : "id";
}

function buildPublishedTicketsSelect(ticketColumns, eventColumns) {
  const cols = ticketColumns instanceof Set ? ticketColumns : new Set();
  const parts = ["id"];

  [
    "event_id",
    "seller_id",
    "seller_name",
    "seller_email",
    "price",
    "currency",
    "sale_type",
    "status",
    "created_at",
    "sector",
    "section_label",
    "row_label",
    "seat_label",
  ].forEach((field) => {
    if (cols.has(field)) parts.push(field);
  });

  if (cols.has("event_id")) {
    parts.push(`event:events(${buildEventSelect(eventColumns)})`);
  }

  return parts.join(",");
}

function normalizeSaleType(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return "—";
  if (raw === "fixed") return "Fija";
  if (raw.includes("nomin")) return "Nominativa";
  return value;
}

function buildTicketType(ticket) {
  const section = ticket?.section_label || ticket?.sector || null;
  const row = ticket?.row_label || null;
  const seat = ticket?.seat_label || null;
  const parts = [
    section ? `Sector ${section}` : null,
    row ? `Fila ${row}` : null,
    seat ? `Asiento ${seat}` : null,
  ].filter(Boolean);

  if (parts.length) return parts.join(" · ");
  return normalizeSaleType(ticket?.sale_type);
}

async function ensureAdmin(req, admin) {
  const { user, error } = await getUserFromBearer(req, admin);
  if (error || !user) {
    return { error: NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 }) };
  }

  const { ok } = await isAdminUser(admin, user);
  if (!ok) {
    return { error: NextResponse.json({ error: "FORBIDDEN" }, { status: 403 }) };
  }

  return { user };
}

export async function GET(req) {
  try {
    const admin = supabaseAdmin();
    const auth = await ensureAdmin(req, admin);
    if (auth.error) return auth.error;

    const url = new URL(req.url);
    const limitRaw = Number(url.searchParams.get("limit") || 500);
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 1000) : 500;

    const ticketColumns = await detectTicketColumns(admin);
    const eventColumns = await detectEventColumns(admin);
    const selectStr = buildPublishedTicketsSelect(ticketColumns, eventColumns);

    const { data: rows, error } = await admin
      .from("tickets")
      .select(selectStr)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const sellerIds = Array.from(
      new Set((rows || []).map((row) => row.seller_id).filter(Boolean))
    );

    const { data: profiles } = sellerIds.length
      ? await admin.from("profiles").select("id,full_name,email").in("id", sellerIds)
      : { data: [] };

    const profilesById = Object.fromEntries((profiles || []).map((row) => [row.id, row]));

    const tickets = (rows || []).map((ticket) => {
      const profile = ticket.seller_id ? profilesById[ticket.seller_id] || null : null;
      const sellerName = ticket.seller_name || profile?.full_name || "Vendedor";
      const sellerEmail = ticket.seller_email || profile?.email || null;

      return {
        id: ticket.id,
        event_id: ticket.event_id || ticket.event?.id || null,
        event: ticket.event || null,
        seller: {
          id: ticket.seller_id || null,
          name: sellerName,
          email: sellerEmail,
        },
        price: ticket.price ?? null,
        currency: ticket.currency || "CLP",
        sale_type: ticket.sale_type || null,
        sale_type_label: normalizeSaleType(ticket.sale_type),
        ticket_type: buildTicketType(ticket),
        sector: ticket.sector || ticket.section_label || null,
        row_label: ticket.row_label || null,
        seat_label: ticket.seat_label || null,
        status: ticket.status || null,
        created_at: ticket.created_at || null,
      };
    });

    const summary = {
      total_active: tickets.length,
      events: new Set(tickets.map((ticket) => ticket.event_id).filter(Boolean)).size,
      sellers: new Set(tickets.map((ticket) => ticket.seller.id).filter(Boolean)).size,
    };

    return NextResponse.json({ ok: true, tickets, summary, limit });
  } catch (err) {
    console.error("[admin/published-tickets] error:", err);
    return NextResponse.json(
      { error: err?.message || "Error cargando entradas publicadas" },
      { status: 500 }
    );
  }
}
