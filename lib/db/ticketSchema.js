// Helper para compatibilidad de schema de tickets y selects robustos
// Uso: await detectTicketColumns(supabaseAdmin), buildTicketSelect(columns)

const TICKET_FIELDS = [
  { key: 'price', db: ['price_clp', 'price'], alias: 'price' },
  { key: 'currency', db: ['currency'], alias: 'currency', fallback: 'CLP' },
  { key: 'section', db: ['sector', 'section_label', 'section'], alias: 'section' },
  { key: 'row', db: ['row_label', 'row'], alias: 'row' },
  { key: 'seat', db: ['seat_label', 'seat'], alias: 'seat' },
  { key: 'status', db: ['status'], alias: 'status' },
  { key: 'created_at', db: ['created_at'], alias: 'created_at' },
  { key: 'file_url', db: ['file_url'], alias: 'file_url' },
];

/**
 * Devuelve un Set fijo de columnas conocidas de la tabla tickets
 * @returns {Promise<Set<string>>}
 */
export async function detectTicketColumns() {
  return new Set([
    'id',
    'price_clp',
    'price',
    'currency',
    'sector',
    'section_label',
    'section',
    'row_label',
    'row',
    'seat_label',
    'seat',
    'status',
    'created_at',
    'file_url',
    'is_named',
    // agrega aquí cualquier otra columna relevante
  ]);
}

/**
 * Construye el string select robusto para tickets
 * @param {Set<string>} columns
 * @returns {string}
 */
export function buildTicketSelect(columns) {
  return [
    'id',
    ...TICKET_FIELDS.map(f => {
      const col = f.db.find(c => columns.has(c));
      if (col) {
        if (col !== f.alias) return `${f.alias}:${col}`;
        return col;
      }
      if (f.fallback) return `'${f.fallback}' as ${f.alias}`;
      return null;
    }).filter(Boolean),
    'is_named',
    'event:events(id, title, starts_at, venue, city)'
  ].join(', ');
}

/**
 * Normaliza un ticket recibido del backend
 * @param {object} t
 * @returns {object}
 */
export function normalizeTicket(t) {
  return {
    id: t.id,
    price: t.price,
    currency: t.currency || 'CLP',
    section: t.section,
    row: t.row,
    seat: t.seat,
    status: t.status,
    created_at: t.created_at,
    file_url: t.file_url,
    is_named: t.is_named,
    event: t.event,
  };
}
