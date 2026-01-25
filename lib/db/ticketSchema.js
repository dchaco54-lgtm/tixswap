// lib/db/ticketSchema.js
// Select robusto + normalización de tickets
// - Detecta columnas reales (si se puede)
// - Nunca asume columnas que no existen
// - Prioriza price (canon) y deja price_clp como fallback si existiera

const FIELD_MAP = [
  // Precio: prioriza price SIEMPRE
  { alias: "price", candidates: ["price", "price_clp", "amount_clp", "amount"] },

  { alias: "currency", candidates: ["currency"] },

  { alias: "section", candidates: ["sector", "section_label", "section"] },
  { alias: "row", candidates: ["row_label", "row"] },
  { alias: "seat", candidates: ["seat_label", "seat"] },

  { alias: "status", candidates: ["status"] },
  { alias: "created_at", candidates: ["created_at"] },
  { alias: "file_url", candidates: ["file_url"] },

  { alias: "event_id", candidates: ["event_id"] },
  { alias: "seller_id", candidates: ["seller_id", "owner_id", "user_id"] },

  { alias: "is_named", candidates: ["is_named"] },
];

// fallback mínimo si info_schema no está accesible por PostgREST
const MINIMAL_COLUMNS = new Set([
  "id",
  "event_id",
  "seller_id",
  "price",
  "status",
  "created_at",
]);

/**
 * Detecta columnas REALES de una tabla.
 * OJO: esto puede fallar si tu PostgREST no expone information_schema.
 * En ese caso cae al fallback mínimo (que NO inventa columnas).
 */
export async function detectTicketColumns(supabase, tableName = "tickets") {
  try {
    if (!supabase) return new Set(MINIMAL_COLUMNS);

    const { data, error } = await supabase
      .from("information_schema.columns")
      .select("column_name")
      .eq("table_schema", "public")
      .eq("table_name", tableName);

    if (error || !Array.isArray(data) || data.length === 0) {
      return new Set(MINIMAL_COLUMNS);
    }

    return new Set(data.map((x) => x.column_name));
  } catch {
    return new Set(MINIMAL_COLUMNS);
  }
}

/**
 * Construye el select string robusto SOLO con columnas existentes
 */
export function buildTicketSelect(columns) {
  const cols = columns instanceof Set ? columns : new Set(MINIMAL_COLUMNS);

  const parts = ["id"];

  for (const f of FIELD_MAP) {
    const col = f.candidates.find((c) => cols.has(c));
    if (!col) continue;

    // alias:col si cambia el nombre
    if (col !== f.alias) parts.push(`${f.alias}:${col}`);
    else parts.push(col);
  }

  // embed evento si existe relación (si falla el route tiene fallback)
  parts.push("event:events(id,title,starts_at,venue,city)");

  return parts.join(", ");
}

/**
 * Normaliza un ticket a un shape estable para el frontend.
 */
export function normalizeTicket(t) {
  const statusRaw = String(t?.status || "").toLowerCase();

  // opcional: trata available como active para UI si tu negocio lo considera igual
  const status =
    statusRaw === "available" ? "active" : statusRaw || null;

  const priceNum = Number(t?.price ?? 0);
  const safePrice = Number.isFinite(priceNum) ? Math.round(priceNum) : 0;

  return {
    id: t?.id,
    event_id: t?.event_id || null,
    seller_id: t?.seller_id || null,

    price: safePrice,
    currency: t?.currency || "CLP",

    section: t?.section ?? null,
    row: t?.row ?? null,
    seat: t?.seat ?? null,

    status,
    created_at: t?.created_at ?? null,

    file_url: t?.file_url ?? null,
    is_named: t?.is_named ?? null,

    event: t?.event ?? null,
  };
}

