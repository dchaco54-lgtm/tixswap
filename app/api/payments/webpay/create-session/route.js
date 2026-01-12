import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getFees } from "@/lib/fees";
import { getWebpayTransaction } from "@/lib/webpay";

export const runtime = "nodejs";

const BUYABLE = new Set(["available", "published", "active", "listed"]);

function makeBuyOrder() {
  const ts = Date.now().toString();
  const rnd = Math.floor(Math.random() * 9000 + 1000).toString();
  return `TSW${ts}${rnd}`.slice(0, 26);
}

export async function POST(req) {
  try {
    const body = await req.json();
    const ticketId = body?.ticketId;

    if (!ticketId) {
      return NextResponse.json({ ok: false, error: "ticketId is required" }, { status: 400 });
    }

    const supabase = createRouteHandlerClient({ cookies });
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    // ✅ admin client
    const admin = supabaseAdmin();

    // 1) Ticket
    const { data: ticket, error: ticketErr } = await admin
      .from("tickets")
      .select("id, price, status, seller_id, event_id")
      .eq("id", ticketId)
      .single();

    if (ticketErr || !ticket) {
      return NextResponse.json({ ok: false, error: "Ticket not found" }, { status: 404 });
    }
    if (!BUYABLE.has(ticket.status)) {
      return NextResponse.json({ ok: false, error: "Ticket not available" }, { status: 409 });
    }

    const fees = getFees(ticket.price);
    const total = fees.total;

    // 2) URLs
    const proto = req.headers.get("x-forwarded-proto") || "https";
    const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
    const baseUrl = `${proto}://${host}`;
    const returnUrl = `${baseUrl}/api/payments/webpay/return`;

    // 3) Hold ticket
    await admin.from("tickets").update({ status: "held" }).eq("id", ticketId);

    // 4) Crear transacción Webpay
    const buyOrder = makeBuyOrder();
    const sessionId = `${user.id}:${ticketId}`.slice(0, 61);

    const tx = getWebpayTransaction();
    const { token, url } = await tx.create(buyOrder, sessionId, total, returnUrl);

    // 5) Guardar orden mínima
    const { data: order, error: orderErr } = await admin
      .from("orders")
      .insert({
        ticket_id: ticketId,
        seller_id: ticket.seller_id,
        event_id: ticket.event_id,
        buy_order: buyOrder,
        webpay_token: token,
        total_amount: total,
        amount_clp: ticket.price,
        buyer_id: user.id,
        status: "pending_payment",
      })
      .select("id")
      .single();

    if (orderErr) {
      console.error("Order insert error:", orderErr);
      return NextResponse.json({ ok: false, error: "Order insert failed (check DB schema)" }, { status: 500 });
    }

    // 6) URL interna que hace POST a Webpay
    const processUrl = `${baseUrl}/payment/webpay/redirect?token=${encodeURIComponent(token)}&url=${encodeURIComponent(url)}`;

    return NextResponse.json({ ok: true, processUrl, token, url, buyOrder, orderId: order.id });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ ok: false, error: "Unexpected error" }, { status: 500 });
  }
}

