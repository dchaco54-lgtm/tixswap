import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function toNum(v) {
  const n = typeof v === "number" ? v : Number(String(v ?? "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

export async function GET(req, { params }) {
  try {
    const supabase = createServerClient(cookies());
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const orderId = params.orderId;

    const { data: order, error } = await supabase
      .from("orders")
      .select(
        [
          "id",
          "ticket_id",
          "buyer_id",
          "seller_id",
          "status",
          "payment_state",
          "payment_provider",
          "payment_method",
          "created_at",
          "updated_at",
          "paid_at",
          "buy_order",
          "session_id",
          "webpay_token",
          "amount_clp",
          "fee_clp",
          "fees_clp",
          "total_clp",
          "total_paid_clp",
          "total_amount",
          "currency",
          "event_id",
        ].join(",")
      )
      .eq("id", orderId)
      .maybeSingle();

    if (error || !order) {
      return NextResponse.json({ error: "Compra no encontrada" }, { status: 404 });
    }

    // Lo puede ver comprador O vendedor
    if (order.buyer_id !== user.id && order.seller_id !== user.id) {
      return NextResponse.json({ error: "Prohibido" }, { status: 403 });
    }

    const ticket = order.ticket_id
      ? (await supabase.from("tickets").select("*").eq("id", order.ticket_id).maybeSingle()).data
      : null;

    const eventId = order.event_id ?? ticket?.event_id ?? null;
    const event = eventId
      ? (await supabase.from("events").select("*").eq("id", eventId).maybeSingle()).data
      : null;

    const sellerId = order.seller_id ?? ticket?.seller_id ?? null;
    const seller = sellerId
      ? (await supabase.from("profiles").select("*").eq("id", sellerId).maybeSingle()).data
      : null;

    const mergedOrder = {
      id: order.id,
      status: order.status ?? "pending",
      created_at: order.created_at,
      updated_at: order.updated_at,
      paid_at: order.paid_at,

      amount_clp: toNum(order.amount_clp),
      fee_clp: toNum(order.fee_clp ?? order.fees_clp),
      total_clp: toNum(order.total_clp ?? order.total_paid_clp ?? order.total_amount),
      currency: order.currency ?? "CLP",

      payment_state: order.payment_state,
      payment_provider: order.payment_provider ?? order.payment_method ?? null,
      buy_order: order.buy_order ?? null,
      session_id: order.session_id ?? null,
      webpay_token: order.webpay_token ?? null,

      ticket_id: order.ticket_id,
      event_id: order.event_id ?? ticket?.event_id ?? null,
      buyer_id: order.buyer_id,
      seller_id: order.seller_id,

      ticket,
      event,
      seller,
    };

    return NextResponse.json(
      {
        order: mergedOrder,
        ticket,
        event,
        seller,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("[orders/[orderId]] Error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

