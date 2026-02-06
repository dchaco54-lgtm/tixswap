// Helper para compatibilidad de schema de tickets y selects robustos.
// Objetivo: evitar 500 por columnas inexistentes (schemas desalineados) y
// mantener un shape consistente en el frontend.

// Nota: En Supabase/PostgREST NO puedes usar expresiones SQL en el select.
// Solo columnas, alias tipo `alias:col`, y embeds (relaciones) tipo `event:events(...)`.

const TICKET_FIELDS = [
  // ✅ Priorizar price (tu tabla real) antes que price_clp (por si existiera en otro schema)
  { key: "price", db: ["price", "price_clp"], alias: "price" },

  { key: "currency", db: ["currency"], alias: "currency" },
  { key: "section", db: ["sector", "section_label", "section"], alias: "section" },
  { key: "row", db: ["row_label", "row"], alias: "row" },
  { key: "seat", db: ["seat_label", "seat"], alias: "seat" },
  { key: "status", db: ["status"], alias: "status" },
  { key: "created_at", db: ["created_at"], alias: "created_at" },

  // ✅ NO seleccionar file_url porque en tu DB no existe -> te está tirando 500
  // { key: 'file_url', db: ['file_url'], alias: 'file_url' },

  // (Opcional útil para debug / dashboard)
  { key: "original_price", db: ["original_price"], alias: "original_price" },
];

let _cachedColumns = null;

async function detectByInformationSchema(supabase) {
  const { data, error } = await supabase
    .from("information_schema.columns")
    .select("column_name")
    .eq("table_schema", "public")
    .eq("table_name", "tickets");

  if (error || !Array.isArray(data)) return null;
  return new Set(data.map((r) => r.column_name).filter(Boolean));
}

async function detectBySampleRow(supabase) {
  const { data, error } = await supabase.from("tickets").select("*").limit(1);
  if (error) return null;
  const row = Array.isArray(data) && data.length ? data[0] : null;
  if (!row || typeof row !== "object") return new Set();
  return new Set(Object.keys(row));
}

/**
 * Detecta columnas reales en `tickets` y las cachea (best-effort).
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @returns {Promise<Set<string>>}
 */
export async function detectTicketColumns(supabase) {
  if (_cachedColumns) return _cachedColumns;

  if (!supabase || typeof supabase.from !== "function") {
    _cachedColumns = new Set(["id"]);
    return _cachedColumns;
  }

  // 1) Intento por information_schema (si está expuesto)
  try {
    const cols = await detectByInformationSchema(supabase);
    if (cols) {
      _cachedColumns = cols;
      return _cachedColumns;
    }
  } catch {
    // noop
  }

  // 2) Fallback por sample row
  try {
    const cols = await detectBySampleRow(supabase);
    _cachedColumns = cols || new Set(["id"]);
    return _cachedColumns;
  } catch {
    _cachedColumns = new Set(["id"]);
    return _cachedColumns;
  }
}

/**
 * Construye select string robusto para tickets.
 * Solo incluye columnas que existan según `columns`.
 * @param {Set<string>} columns
 * @returns {string}
 */
export function buildTicketSelect(columns) {
  const cols = columns instanceof Set ? columns : new Set();

  const parts = ["id"];

  // Mantener event_id si existe (sirve para fallback si el embed de events falla)
  if (cols.has("event_id")) parts.push("event_id");

  for (const f of TICKET_FIELDS) {
    const col = f.db.find((c) => cols.has(c));
    if (!col) continue;
    if (col !== f.alias) parts.push(`${f.alias}:${col}`);
    else parts.push(col);
  }

  // Opcionales
  if (cols.has("is_named")) parts.push("is_named");
  if (cols.has("ticket_upload_id")) parts.push("ticket_upload_id");
  if (cols.has("ticket_uploads_id")) parts.push("ticket_uploads_id");
  if (cols.has("is_nominated")) parts.push("is_nominated");
  if (cols.has("is_nominada")) parts.push("is_nominada");

  // Embed de evento solo si existe event_id
  if (cols.has("event_id")) {
    parts.push("event:events(id, title, starts_at, venue, city, image_url, nomination_enabled_at, renomination_cutoff_hours, renomination_max_changes)");
  }

  return parts.join(", ");
}

/**
 * Normaliza un ticket recibido del backend
 * @param {object} t
 * @returns {object}
 */
export function normalizeTicket(t) {
  const normalized = {
    id: t.id,
    price: t.price ?? t.price_clp ?? null,
    original_price: t.original_price ?? null,
    currency: t.currency || "CLP",
    section: t.section ?? t.sector ?? null,
    row: t.row ?? t.row_label ?? null,
    seat: t.seat ?? t.seat_label ?? null,
    status: t.status || null,
    created_at: t.created_at || null,

    // ✅ aunque no exista en DB, dejamos el campo para el front
    file_url: null,

    is_named: !!t.is_named,
    event: t.event || null,
  };

  normalized.ticket_upload = t.ticket_upload ?? null;
  normalized.is_nominated = Boolean(
    t.ticket_upload?.is_nominated ??
    t.ticket_upload?.is_nominada ??
    false
  );

  return normalized;
}
