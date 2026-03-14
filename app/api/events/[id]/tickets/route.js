import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { buildTicketSelect, detectEventColumns, detectTicketColumns, normalizeTicket } from "@/lib/db/ticketSchema";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;

async function getSellerValidadoMap(admin, tickets) {
  const sellerIds = [
    ...new Set((tickets || []).map((ticket) => ticket?.seller_id).filter(Boolean)),
  ];

  if (sellerIds.length === 0) return new Map();

  const { data, error } = await admin
    .from("profiles")
    .select("id, validado")
    .in("id", sellerIds);

  if (error || !Array.isArray(data)) {
    return new Map();
  }

  return new Map(data.map((profile) => [profile.id, profile.validado === true]));
}

function normalizePublicTicket(t) {
  return {
    id: t.id,
    event_id: t.event_id || null,
    seller_id: t.seller_id || null,
    seller_name: t.seller_name || null,
    seller_validado: t.seller_validado === true,
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
      const sellerValidadoMap = await getSellerValidadoMap(admin, publicTickets || []);

      return NextResponse.json({
        tickets: (publicTickets || []).map((t) =>
          normalizePublicTicket({
            ...t,
            seller_validado: sellerValidadoMap.get(t.seller_id) ?? false,
          })
        ),
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

    const sellerValidadoMap = await getSellerValidadoMap(admin, tickets || []);
    const normalized = (tickets || []).map((t) => ({
      ...normalizeTicket(t),
      seller_id: t.seller_id || null,
      seller_name: t.seller_name || null,
      seller_validado: sellerValidadoMap.get(t.seller_id) ?? false,
    }));
    return NextResponse.json({ tickets: normalized });
  } catch (e) {
    return NextResponse.json({ error: e?.message || "Error" }, { status: 500 });
  }
}
