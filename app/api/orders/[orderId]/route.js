import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function toNum(v) {
  const n = typeof v === "number" ? v : Number(String(v ?? "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

async function getUserFromRequest(req) {
  try {
    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;

    if (!token) return null;

    const admin = supabaseAdmin();
    const { data, error } = await admin.auth.getUser(token);
    if (error || !data?.user) return null;
    return data.user;
  } catch {
    return null;
  }
}

export async function GET(req, { params }) {
  try {
    const user = await getUserFromRequest(req);

    if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const orderId = params.orderId;
    const admin = supabaseAdmin();

    const { data: order, error } = await admin
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .maybeSingle();

    if (error || !order) {
      return NextResponse.json({ error: "Compra no encontrada" }, { status: 404 });
    }

    if (order.buyer_id !== user.id) {
      return NextResponse.json({ error: "Prohibido" }, { status: 403 });
    }

    const ticket = order.ticket_id
      ? (await admin.from("tickets").select("*").eq("id", order.ticket_id).maybeSingle()).data
      : null;

    const eventId = order.event_id ?? ticket?.event_id ?? null;
    const event = eventId
      ? (await admin.from("events").select("*").eq("id", eventId).maybeSingle()).data
      : null;

    const sellerId = order.seller_id ?? ticket?.seller_id ?? null;
    const seller = sellerId
      ? (await admin.from("profiles").select("*").eq("id", sellerId).maybeSingle()).data
      : null;

    return NextResponse.json(
      {
        order: {
          id: order.id,
          status: order.status ?? "pending",
          created_at: order.created_at,
          amount_clp: toNum(order.amount_clp),
          fee_clp: toNum(order.fee_clp ?? order.fees_clp),
          total_paid_clp: toNum(order.total_paid_clp ?? order.total_clp ?? order.total_amount),
          payment_state: order.payment_state,
          payment_provider: order.payment_provider ?? order.payment_method ?? null,
          ticket_id: order.ticket_id,
          event_id: order.event_id,
        },
        ticket,
        event,
        seller,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error('[orders/[orderId]] Error:', err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
