import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { buildTicketSelect, detectEventColumns, detectTicketColumns, normalizeTicket } from "@/lib/db/ticketSchema";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;


function normalizePublicTicket(t) {
  return {
    id: t.id,
    event_id: t.event_id || null,
    seller_id: t.seller_id || null,
    seller_name: t.seller_name || null,
    price: t.price ?? null,
    currency: t.currency || "CLP",
    section: t.section_label || t.sector || t.section || null,
    row: t.row_label || t.row || null,
    seat: t.seat_label || t.seat || null,
    status: t.status || null,
    created_at: t.created_at || null,
    title: t.title || null,
    sale_type: t.sale_type || null,
    file_url: null,
    is_named: false,
    is_nominated: false,
  };
}

function isMissingRelationError(error) {
  const code = String(error?.code || "");
  const msg = String(error?.message || "").toLowerCase();
  return (
    code === "PGRST204" ||
    (msg.includes("tickets_public") && msg.includes("schema cache"))
  );
}
export async function GET(req, { params }) {
  try {
    const admin = supabaseAdmin();

    const eventId = params?.id;
    if (!eventId) {
      return NextResponse.json({ error: "Falta id de evento" }, { status: 400 });
    }

    const { data: publicTickets, error: publicErr } = await admin
      .from("tickets_public")
      .select(
        "id, event_id, seller_id, seller_name, status, price, currency, sector, row_label, seat_label, section_label, created_at, title, sale_type"
      )
      .eq("event_id", eventId)
      .in("status", ["active", "available"])
      .order("created_at", { ascending: false });

    if (!publicErr) {
      return NextResponse.json({
        tickets: (publicTickets || []).map((t) => normalizePublicTicket(t)),
      });
    }

    if (!isMissingRelationError(publicErr)) {
      return NextResponse.json({ error: publicErr.message }, { status: 500 });
    }

    const cols = await detectTicketColumns(admin);
    const eventCols = await detectEventColumns(admin);
    const select = buildTicketSelect(cols, eventCols);

    const { data: tickets, error: errTickets } = await admin
      .from("tickets")
      .select(select)
      .eq("event_id", eventId)
      // ✅ compat: "available" (nuevo) + "active" (legacy)
      .in("status", ["active", "available"])
      .order("created_at", { ascending: false });

    if (errTickets) {
      return NextResponse.json({ error: errTickets.message }, { status: 500 });
    }

    const normalized = (tickets || []).map((t) => normalizeTicket(t));
    return NextResponse.json({ tickets: normalized });
  } catch (e) {
    return NextResponse.json({ error: e?.message || "Error" }, { status: 500 });
  }
}
