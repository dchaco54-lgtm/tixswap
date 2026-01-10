import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

function toNum(v) {
  const n = typeof v === "number" ? v : Number(String(v ?? "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

export async function GET(req, { params }) {
  const supabase = createRouteHandlerClient({ cookies });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const orderId = params.orderId;
  const { data: order, error } = await supabase.from("orders").select("*").eq("id", orderId).maybeSingle();

  if (error || !order) return NextResponse.json({ error: "Compra no encontrada" }, { status: 404 });

  if (order.buyer_id !== user.id) return NextResponse.json({ error: "Prohibido" }, { status: 403 });

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

  return NextResponse.json(
    {
      order: {
        id: order.id,
        status: order.status ?? "pending",
        created_at: order.created_at,
        total_clp: toNum(order.total_clp ?? order.total_paid_clp ?? order.total_amount),
        fee_clp: toNum(order.fee_clp ?? order.fees_clp),
        payment_provider: order.payment_provider ?? order.payment_method ?? null,
      },
      ticket,
      event,
      seller,
    },
    { status: 200 }
  );
}
