// lib/db/ticketSchema.js

// Define el orden “canon” para cada campo. Para precio: primero `price`, luego fallbacks.
const TICKET_FIELDS = [
  { key: "id", db: ["id"], alias: "id" },
  { key: "created_at", db: ["created_at"], alias: "created_at" },
  { key: "status", db: ["status"], alias: "status" },
  { key: "event_id", db: ["event_id"], alias: "event_id" },
  { key: "seller_id", db: ["seller_id", "owner_id", "user_id"], alias: "seller_id" },

  // ✅ PRECIO: primero price, luego price_clp, luego otros posibles
  { key: "price", db: ["price", "price_clp", "amount_clp", "amount"], alias: "price" },

  // Extras opcionales (no rompen si no existen)
  { key: "original_price", db: ["original_price", "original_price_clp"], alias: "original_price" },

  // Asiento / sector (múltiples nombres posibles)
  { key: "section", db: ["section", "sector"], alias: "section" },
  { key: "row_label", db: ["row_label", "row"], alias: "row_label" },
  { key: "seat_label", db: ["seat_label", "seat"], alias: "seat_label" },

  { key: "notes", db: ["notes"], alias: "notes" },
];

// Cache simple por proceso
let _cachedColumns = null;

export async function detectTicketColumns(admin) {
  if (_cachedColumns) return _cachedColumns;

  const { data, error } = await admin
    .from("information_schema.columns")
    .select("column_name")
    .eq("table_schema", "public")
    .eq("table_name", "tickets");

  if (error) {
    // Si falla, devolvemos set vacío (y buildTicketSelect usará el primer nombre directo)
    _cachedColumns = new Set();
    return _cachedColumns;
  }

  _cachedColumns = new Set((data || []).map((x) => x.column_name));
  return _cachedColumns;
}

function safeCoalesceExpr(cols, options, alias) {
  const existing = options.filter((c) => cols.has(c));
  if (existing.length === 0) {
    // Fallback: usa el primer nombre “teórico”
    return `t.${options[0]} as ${alias}`;
  }
  if (existing.length === 1) {
    return `t.${existing[0]} as ${alias}`;
  }
  return `COALESCE(${existing.map((c) => `t.${c}`).join(", ")}) as ${alias}`;
}

export function buildTicketSelect(cols) {
  // Embed de evento (si hay relación)
  const base = TICKET_FIELDS.map((f) => safeCoalesceExpr(cols, f.db, f.alias));

  // Intentar embed por relación si existe (puede fallar por schema cache; tu route ya tiene fallback)
  base.push("event:events(id,title,starts_at,venue,city,image_url)");

  return base.join(", ");
}

export function normalizeTicket(raw) {
  if (!raw) return null;

  const price =
    raw.price != null
      ? Number(raw.price)
      : raw.price_clp != null
        ? Number(raw.price_clp)
        : raw.amount_clp != null
          ? Number(raw.amount_clp)
          : raw.amount != null
            ? Number(raw.amount)
            : 0;

  return {
    id: raw.id,
    created_at: raw.created_at,
    status: raw.status ?? null,
    event_id: raw.event_id ?? null,
    seller_id: raw.seller_id ?? raw.owner_id ?? raw.user_id ?? null,

    section: raw.section ?? raw.sector ?? null,
    row: raw.row_label ?? raw.row ?? null,
    seat: raw.seat_label ?? raw.seat ?? null,
    notes: raw.notes ?? null,

    price: Number.isFinite(price) ? Math.max(0, Math.round(price)) : 0,
    original_price:
      raw.original_price != null ? Number(raw.original_price) : null,

    event: raw.event ?? null,
  };
}

