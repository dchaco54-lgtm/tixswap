// app/api/payments/webpay/return/route.js
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { commitTransaction } from "@/lib/transbank";

async function detectTicketCols(admin) {
  // SQL editor sí ve information_schema, pero PostgREST no siempre.
  // Así que detectamos por sample row (sirve para saber si existen columnas tipo buyer_id/sold_at).
  const { data, error } = await admin.from("tickets").select("*").limit(1);
  if (error) return new Set();
  const row = Array.isArray(data) && data.length ? data[0] : null;
  return new Set(row ? Object.keys(row) : []);
}

export async function GET(request) {
  const admin = supabaseAdmin();

  try {
    const url = new URL(request.url);
    const searchParams = url.searchParams;

    const token_ws = searchParams.get("token_ws");
    const buyOrderParam = searchParams.get("TBK_ORDEN_COMPRA");

    if (!token_ws) {
      // usuario canceló o retorno raro
      const res = NextResponse.redirect(new URL("/checkout?status=cancel", request.url));
      res.headers.set("Cache-Control", "no-store");
      return res;
    }

    const buyOrder = buyOrderParam || null;

    // 1) Commit Webpay
    const commitRes = await commitTransaction(token_ws);

    // 2) Buscar la orden
    const { data: order, error: orderError } = await admin
      .from("orders")
      .select("id,ticket_id,user_id,status,payment_state")
      .eq("buy_order", buyOrder)
      .maybeSingle();

    if (orderError || !order) {
      console.error("[webpay return] order not found", orderError);
      const res = NextResponse.redirect(new URL("/checkout?status=order_not_found", request.url));
      res.headers.set("Cache-Control", "no-store");
      return res;
    }

    const responseCode = Number(commitRes?.responseCode ?? commitRes?.response_code ?? -1);
    const isApproved = responseCode === 0;

    // 3) Update orden
    await admin
      .from("orders")
      .update({
        status: isApproved ? "paid" : "failed",
        payment_state: isApproved ? "paid" : "failed",
        authorization_code: commitRes?.authorizationCode ?? commitRes?.authorization_code ?? null,
        payment_data: commitRes || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", order.id);

    // 4) Update ticket
    if (order.ticket_id) {
      const cols = await detectTicketCols(admin);

      if (isApproved) {
        // ✅ intentamos update completo, pero solo con columnas que existan
        const patch = { status: "sold" };
        if (cols.has("buyer_id")) patch.buyer_id = order.user_id;
        if (cols.has("sold_at")) patch.sold_at = new Date().toISOString();
        if (cols.has("hold_expires_at")) patch.hold_expires_at = null;

        const { error: tErr } = await admin.from("tickets").update(patch).eq("id", order.ticket_id);

        if (tErr) {
          console.error("[webpay return] ticket sold update failed:", tErr);
          // fallback ultra seguro: al menos dejar sold
          await admin.from("tickets").update({ status: "sold" }).eq("id", order.ticket_id);
        }
      } else {
        // pago fallido → liberar
        const patch = { status: "active" };
        if (cols.has("hold_expires_at")) patch.hold_expires_at = null;

        await admin.from("tickets").update(patch).eq("id", order.ticket_id);
      }
    }

    // 5) Redirect
    const res = NextResponse.redirect(
      new URL(isApproved ? "/dashboard/purchases?paid=1" : "/checkout?status=failed", request.url)
    );
    res.headers.set("Cache-Control", "no-store");
    return res;
  } catch (err) {
    console.error("[webpay return] unexpected error", err);
    const res = NextResponse.redirect(new URL("/checkout?status=error", request.url));
    res.headers.set("Cache-Control", "no-store");
    return res;
  }
}

