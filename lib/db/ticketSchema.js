// lib/db/ticketSchema.js
export const TICKET_FIELDS = [
  { key: 'id', db: ['id'], alias: 'id' },
  { key: 'event_id', db: ['event_id'], alias: 'event_id' },
  { key: 'seller_id', db: ['seller_id', 'user_id'], alias: 'seller_id' },
  { key: 'status', db: ['status'], alias: 'status' },

  // ✅ IMPORTANTÍSIMO: priorizar price por sobre price_clp
  { key: 'price', db: ['price', 'price_clp'], alias: 'price' },

  { key: 'price_clp', db: ['price_clp'], alias: 'price_clp' },
  { key: 'original_price', db: ['original_price'], alias: 'original_price' },
  { key: 'currency', db: ['currency'], alias: 'currency' },
  { key: 'sector', db: ['sector'], alias: 'sector' },
  { key: 'row', db: ['row', 'row_label'], alias: 'row' },
  { key: 'seat', db: ['seat', 'seat_label'], alias: 'seat' },
  { key: 'notes', db: ['notes'], alias: 'notes' },
  { key: 'pdf_url', db: ['pdf_url'], alias: 'pdf_url' },
  { key: 'event_image_url', db: ['event_image_url'], alias: 'event_image_url' },
  { key: 'created_at', db: ['created_at'], alias: 'created_at' },
  { key: 'updated_at', db: ['updated_at'], alias: 'updated_at' },
];

export async function detectTicketColumns(admin) {
  try {
    const { data, error } = await admin
      .from('information_schema.columns')
      .select('column_name')
      .eq('table_schema', 'public')
      .eq('table_name', 'tickets');

    if (error) throw error;
    const set = new Set((data || []).map((r) => r.column_name));
    return set;
  } catch (e) {
    console.warn('detectTicketColumns fallback error', e?.message || e);
    return new Set();
  }
}

export function buildTicketSelect(cols) {
  const selectParts = [];

  for (const f of TICKET_FIELDS) {
    const exists = f.db.find((c) => cols.has(c));
    if (!exists) continue;
    if (f.alias && exists !== f.alias) selectParts.push(`${exists}:${f.alias}`);
    else selectParts.push(exists);
  }

  return selectParts.join(',');
}

export function normalizeTicket(t) {
  if (!t) return null;
  return {
    id: t.id,
    event_id: t.event_id,
    seller_id: t.seller_id,
    status: t.status,
    // ✅ esta lógica ya prioriza price correctamente
    price: t.price ?? t.price_clp ?? null,
    price_clp: t.price_clp ?? null,
    original_price: t.original_price ?? null,
    currency: t.currency ?? 'CLP',
    sector: t.sector ?? null,
    row: t.row ?? null,
    seat: t.seat ?? null,
    notes: t.notes ?? null,
    pdf_url: t.pdf_url ?? null,
    event_image_url: t.event_image_url ?? null,
    created_at: t.created_at ?? null,
    updated_at: t.updated_at ?? null,
  };
}

