// app/api/payments/webpay/return/route.js
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getWebpayTransaction } from "@/lib/webpay";

export const runtime = "nodejs";

function safeHost() {
  return (
    process.env.SITE_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "https://tixswap.cl"
  ).replace(/\/$/, "");
}

function redirectToResult(params) {
  const host = safeHost();
  const qs = new URLSearchParams(params);
  return NextResponse.redirect(`${host}/payment/webpay/result?${qs.toString()}`);
}

async function extractFromReq(req) {
  const url = new URL(req.url);
  const sp = url.searchParams;

  let token_ws = sp.get("token_ws");
  let TBK_TOKEN = sp.get("TBK_TOKEN");
  let TBK_ORDEN_COMPRA = sp.get("TBK_ORDEN_COMPRA");
  let TBK_ID_SESION = sp.get("TBK_ID_SESION");

  if (req.method === "POST") {
    const fd = await req.formData().catch(() => null);
    if (fd) {
      token_ws = token_ws || fd.get("token_ws");
      TBK_TOKEN = TBK_TOKEN || fd.get("TBK_TOKEN");
      TBK_ORDEN_COMPRA = TBK_ORDEN_COMPRA || fd.get("TBK_ORDEN_COMPRA");
      TBK_ID_SESION = TBK_ID_SESION || fd.get("TBK_ID_SESION");
    }
  }

  return {
    token_ws: token_ws ? String(token_ws) : null,
    tbkToken: TBK_TOKEN ? String(TBK_TOKEN) : null,
    tbkBuyOrder: TBK_ORDEN_COMPRA ? String(TBK_ORDEN_COMPRA) : null,
    tbkSessionId: TBK_ID_SESION ? String(TBK_ID_SESION) : null,
  };
}

async function releaseTicket(admin, order) {
  if (!order?.ticket_id) return;
  await admin
    .from("tickets")
    .update({ status: "active" })
    .eq("id", order.ticket_id)
    .eq("status", "held");
}

async function markSold(admin, order) {
  if (!order?.ticket_id) return;
  await admin.from("tickets").update({ status: "sold" }).eq("id", order.ticket_id);
}

export async function GET(req) {
  const admin = supabaseAdmin();
  const p = await extractFromReq(req);

  // Flujo normal
  if (p.token_ws) {
    const { data: order } = await admin
      .from("orders")
      .select("id, ticket_id, total_amount, buy_order")
      .eq("webpay_token", p.token_ws)
      .maybeSingle();

    if (!order?.id) return redirectToResult({ status: "unknown" });

    const tx = getWebpayTransaction();

    // commit(token)
    const commitRes = await tx.commit(p.token_ws);

    const approved =
      String(commitRes?.status) === "AUTHORIZED" &&
      Number(commitRes?.response_code) === 0;

    if (approved) {
      const cardLast4 = String(commitRes?.card_detail?.card_number || "").slice(-4);

      await admin.from("orders").update({
        status: "paid",
        payment_state: "paid",
        total_paid_clp: commitRes?.amount,
        paid_at: new Date().toISOString(),
        payment_payload: commitRes,
        webpay_authorization_code: commitRes?.authorization_code || null,
        webpay_payment_type_code: commitRes?.payment_type_code || null,
        webpay_installments_number: commitRes?.installments_number ?? null,
        webpay_card_last4: cardLast4 || null,
      }).eq("id", order.id);

      await markSold(admin, order);
      return redirectToResult({ orderId: order.id, status: "approved" });
    }

    await admin.from("orders").update({
      status: "failed",
      payment_state: "failed",
      payment_payload: commitRes,
    }).eq("id", order.id);

    await releaseTicket(admin, order);
    return redirectToResult({ orderId: order.id, status: "failed" });
  }

  // Abort/timeout
  if (p.tbkBuyOrder) {
    const { data: order } = await admin
      .from("orders")
      .select("id, ticket_id")
      .eq("buy_order", p.tbkBuyOrder)
      .maybeSingle();

    if (order?.id) {
      await admin.from("orders").update({
        status: p.tbkToken ? "canceled" : "timeout",
        payment_state: p.tbkToken ? "canceled" : "timeout",
      }).eq("id", order.id);

      await releaseTicket(admin, order);
      return redirectToResult({ orderId: order.id, status: p.tbkToken ? "canceled" : "timeout" });
    }
  }

  return redirectToResult({ status: "unknown" });
}

export async function POST(req) {
  return GET(req);
}
