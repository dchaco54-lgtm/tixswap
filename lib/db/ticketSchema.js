// lib/db/ticketSchema.js
// Schema-aware ticket select builder: avoids PostgREST errors when columns are missing.
// It detects available columns from information_schema (preferred) or falls back to a sample row.

const FIELDS = [
  { key: 'id', db: ['id'], alias: 'id' },
  { key: 'event_id', db: ['event_id'], alias: 'event_id' },
  { key: 'seller_id', db: ['seller_id'], alias: 'seller_id' },

  // Preferimos `price` (el que editas en dashboard/BD). Si existe `price_clp` por legado, queda como fallback.
  { key: 'price', db: ['price', 'price_clp'], alias: 'price' },

  { key: 'sale_type', db: ['sale_type'], alias: 'sale_type' },
  { key: 'status', db: ['status', 'state'], alias: 'status' },
  { key: 'section', db: ['section'], alias: 'section' },
  { key: 'row', db: ['row'], alias: 'row' },
  { key: 'seat', db: ['seat'], alias: 'seat' },
  { key: 'notes', db: ['notes', 'comment'], alias: 'notes' },
  { key: 'created_at', db: ['created_at'], alias: 'created_at' },
];

let _cachedColumns = null;

async function detectByInformationSchema(supabase) {
  // NOTE: PostgREST in Supabase may not expose information_schema by default.
  // This can fail depending on config; we treat failures as "unknown".
  const { data, error } = await supabase
    .from('information_schema.columns')
    .select('column_name')
    .eq('table_schema', 'public')
    .eq('table_name', 'tickets');

  if (error || !data) return null;
  return new Set(data.map((r) => r.column_name));
}

async function detectBySampleRow(supabase) {
  const { data, error } = await supabase
    .from('tickets')
    .select('*')
    .limit(1)
    .maybeSingle();

  if (error || !data) return new Set();
  return new Set(Object.keys(data));
}

export async function detectTicketColumns(supabase) {
  if (_cachedColumns) return _cachedColumns;

  try {
    const cols1 = await detectByInformationSchema(supabase).catch(() => null);
    if (cols1 && cols1.size > 0) {
      _cachedColumns = cols1;
      return _cachedColumns;
    }
  } catch {
    // ignore
  }

  _cachedColumns = await detectBySampleRow(supabase);
  return _cachedColumns;
}

function pickExistingColumn(cols, dbList) {
  for (const col of dbList) {
    if (cols.has(col)) return col;
  }
  return null;
}

export function buildTicketSelect(cols) {
  const parts = [];

  for (const f of FIELDS) {
    const col = pickExistingColumn(cols, f.db);
    if (!col) continue;

    // Alias only when needed
    if (f.alias && f.alias !== col) {
      parts.push(`${f.alias}:${col}`);
    } else if (f.alias && f.alias === col) {
      // Keep explicit alias (safe), but could also just push col
      parts.push(`${f.alias}:${col}`);
    } else {
      parts.push(col);
    }
  }

  // Always include at least id to avoid empty select
  if (!parts.some((p) => p.startsWith('id'))) parts.unshift('id');

  // Embed event (safe fields only)
  parts.push('event:events(id,title,starts_at,venue,city,image_url)');

  return parts.join(',');
}

export function normalizeTicket(t) {
  const status = String(t?.status || 'active').toLowerCase();
  const price = t?.price ?? t?.price_clp ?? null;

  return {
    id: t?.id ?? null,
    event_id: t?.event_id ?? null,
    seller_id: t?.seller_id ?? null,
    price: typeof price === 'string' ? Number(price) : price,
    sale_type: t?.sale_type ?? null,
    status,
    section: t?.section ?? null,
    row: t?.row ?? null,
    seat: t?.seat ?? null,
    notes: t?.notes ?? null,
    created_at: t?.created_at ?? null,
    event: t?.event ?? null,
  };
}

