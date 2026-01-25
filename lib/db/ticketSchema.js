// lib/db/ticketSchema.js
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const TICKET_FIELDS = [
  // ✅ FIX: primero price, después price_clp (legacy)
  { key: "price", db: ["price", "price_clp"], alias: "price" },

  { key: "sector", db: ["sector"], alias: "sector" },
  { key: "row", db: ["row", "row_label"], alias: "row" },
  { key: "seat", db: ["seat", "seat_label"], alias: "seat" },
  { key: "status", db: ["status"], alias: "status" },
  { key: "notes", db: ["notes"], alias: "notes" },
  { key: "created_at", db: ["created_at"], alias: "created_at" },
];

let cachedColumns = null;

async function detectByInformationSchema(admin) {
  const { data, error } = await admin
    .from("information_schema.columns")
    .select("column_name")
    .eq("table_schema", "public")
    .eq("table_name", "tickets");

  if (error) return null;
  return new Set((data || []).map((x) => x.column_name));
}

async function detectBySampleRow(admin) {
  const { data, error } = await admin.from("tickets").select("*").limit(1);
  if (error || !data || !data.length) return new Set();
  return new Set(Object.keys(data[0]));
}

async function detectColumns() {
  if (cachedColumns) return cachedColumns;
  const admin = supabaseAdmin();

  let cols = await detectByInformationSchema(admin);
  if (!cols) cols = await detectBySampleRow(admin);

  cachedColumns = cols;
  return cols;
}

export async function buildTicketSelect() {
  const cols = await detectColumns();
  const selected = [];

  for (const f of TICKET_FIELDS) {
    const col = f.db.find((c) => cols.has(c));
    if (!col) continue;
    if (col === f.alias) selected.push(col);
    else selected.push(`${col} as ${f.alias}`);
  }

  if (!selected.length) selected.push("id");
  return selected.join(",");
}

export function normalizeTicket(t) {
  return {
    price: t?.price ?? t?.price_clp ?? null,
    sector: t?.sector ?? null,
    row: t?.row ?? null,
    seat: t?.seat ?? null,
    status: t?.status ?? null,
    notes: t?.notes ?? null,
    created_at: t?.created_at ?? null,
  };
}

