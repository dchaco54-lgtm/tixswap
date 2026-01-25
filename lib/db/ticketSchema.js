// lib/db/ticketSchema.js

const TICKET_COLUMNS = {
  // 👇 IMPORTANTE: priorizamos price (el “canon”)
  price: ["price", "price_clp", "amount_clp", "amount"],
  original_price: ["original_price", "original_price_clp", "face_value", "face_value_clp"],
  status: ["status", "state"],
  seller_id: ["seller_id", "owner_id", "user_id"],
  event_id: ["event_id"],
  created_at: ["created_at"],
  sector: ["sector", "section"],
  row_label: ["row_label", "row"],
  seat_label: ["seat_label", "seat"],
  notes: ["notes"],
  ticket_number: ["ticket_number", "ticket_no"],
  pdf_url: ["pdf_url", "ticket_pdf_url"],
  ticket_pdf_url: ["ticket_pdf_url", "pdf_url"],
  tier: ["tier"],
};

// intenta detectar columnas por information_schema, y si no se puede, por una fila sample
async function detectByInformationSchema(admin, tableName) {
  try {
    const { data, error } = await admin
      .from("information_schema.columns")
      .select("column_name")
      .eq("table_schema", "public")
      .eq("table_name", tableName);

    if (error) return null;
    const set = new Set((data || []).map((x) => x.column_name));
    return set.size ? set : null;
  } catch {
    return null;
  }
}

async function detectBySampleRow(admin, tableName) {
  try {
    const { data, error } = await admin.from(tableName).select("*").limit(1);
    if (error) return new Set();
    const row = Array.isArray(data) && data.length ? data[0] : null;
    return new Set(row ? Object.keys(row) : []);
  } catch {
    return new Set();
  }
}

export async function detectTicketColumns(admin) {
  const byInfo = await detectByInformationSchema(admin, "tickets");
  if (byInfo) return byInfo;
  return await detectBySampleRow(admin, "tickets");
}

function pickExistingColumn(columnsSet, candidates) {
  for (const c of candidates) if (columnsSet.has(c)) return c;
  return null;
}

export function buildTicketSelect(columnsSet) {
  // arma un “select” seguro, usando alias estándar
  const parts = [];

  const colMap = {};
  for (const [alias, candidates] of Object.entries(TICKET_COLUMNS)) {
    const real = pickExistingColumn(columnsSet, candidates);
    if (real) colMap[alias] = real;
  }

  // básicos
  parts.push("id");
  if (colMap.event_id) parts.push(`event_id:${colMap.event_id}`);
  if (colMap.seller_id) parts.push(`seller_id:${colMap.seller_id}`);
  if (colMap.status) parts.push(`status:${colMap.status}`);
  if (colMap.created_at) parts.push(`created_at:${colMap.created_at}`);

  // precio + original
  if (colMap.price) parts.push(`price:${colMap.price}`);
  if (colMap.original_price) parts.push(`original_price:${colMap.original_price}`);

  // asiento / extras
  if (colMap.sector) parts.push(`sector:${colMap.sector}`);
  if (colMap.row_label) parts.push(`row_label:${colMap.row_label}`);
  if (colMap.seat_label) parts.push(`seat_label:${colMap.seat_label}`);
  if (colMap.notes) parts.push(`notes:${colMap.notes}`);
  if (colMap.ticket_number) parts.push(`ticket_number:${colMap.ticket_number}`);
  if (colMap.tier) parts.push(`tier:${colMap.tier}`);

  // pdf
  if (colMap.pdf_url) parts.push(`pdf_url:${colMap.pdf_url}`);
  if (colMap.ticket_pdf_url && colMap.ticket_pdf_url !== colMap.pdf_url) {
    parts.push(`ticket_pdf_url:${colMap.ticket_pdf_url}`);
  }

  // embed evento (si hay relación)
  parts.push("event:events(id,title,starts_at,venue,city,image_url)");

  return parts.join(",");
}

export function normalizeTicket(t) {
  const toNum = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  return {
    id: t?.id,
    event_id: t?.event_id ?? null,
    seller_id: t?.seller_id ?? null,
    status: t?.status ?? null,
    created_at: t?.created_at ?? null,

    // 👇 clave: price es el de venta; original_price solo referencia
    price: toNum(t?.price),
    original_price: toNum(t?.original_price),

    sector: t?.sector ?? null,
    row_label: t?.row_label ?? null,
    seat_label: t?.seat_label ?? null,
    seat:
      [t?.sector, t?.row_label, t?.seat_label].filter(Boolean).join(" • ") ||
      null,

    notes: t?.notes ?? null,
    ticket_number: t?.ticket_number ?? null,
    tier: t?.tier ?? null,

    pdf_url: t?.pdf_url ?? null,
    ticket_pdf_url: t?.ticket_pdf_url ?? null,

    event: t?.event ?? null,
  };
}

