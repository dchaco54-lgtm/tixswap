export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getWebpayTransaction } from "@/lib/webpay";

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase admin env vars");
  return createClient(url, key, { auth: { persistSession: false } });
}

function getBaseUrl(request) {
  const proto = request.headers.get("x-forwarded-proto") || "https";
  const host =
    request.headers.get("x-forwarded-host") ||
    request.headers.get("host") ||
    "";
  if (!host) return "https://tixswap.cl";
  return `${proto}://${host}`;
}

function safeRelativePath(p) {
  if (!p) return "/payment/webpay/result?status=error&reason=missing_path";
  // Bloquear redirects a URLs absolutas
  if (p.startsWith("http://") || p.startsWith("https://")) {
    return "/payment/webpay/result?status=error&reason=invalid_redirect";
  }
  if (!p.startsWith("/")) return `/${p}`;
  return p;
}

function redirectTo(request, path) {
  const base = getBaseUrl(request);
  return NextResponse.redirect(new URL(safeRelativePath(path), base));
}

async function finalizeTicketPurchase(sessionId, payload) {
  const sb = supabaseAdmin();

  const { data: orders, error: orderErr } = await sb
    .from("orders")
    .select("*")
    .eq("session_id", sessionId)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1);

  if (orderErr) throw orderErr;
  const order = orders?.[0];
  if (!order) throw new Error("Order not found for this session");

  const { error: updOrderErr } = await sb
    .from("orders")
    .update({
      status: "paid",
      paid_at: new Date().toISOString(),
      payment_payload: payload,
    })
    .eq("id", order.id);

  if (updOrderErr) throw updOrderErr;

  const { error: updTicketErr } = await sb
    .from("tickets")
    .update({
      status: "sold",
      sold_at: new Date().toISOString(),
      sold_order_id: order.id,
    })
    .eq("id", order.ticket_id);

  if (updTicketErr) throw updTicketErr;

  return order;
}

export async function POST(request) {
  try {
    // Webpay vuelve normalmente con token_ws en POST form-data
    let token = null;

    const url = new URL(request.url);
    token = url.searchParams.get("token_ws");

    if (!token) {
      const ct = request.headers.get("content-type") || "";
      if (ct.includes("application/x-www-form-urlencoded") || ct.includes("multipart/form-data")) {
        const form = await request.formData();
        token = form.get("token_ws");
      }
    }

    if (!token) {
      return redirectTo(request, "/payment/webpay/result?status=error&reason=missing_token");
    }

    const tx = getWebpayTransaction();
    const result = await tx.commit(token);

    const isAuthorized =
      result?.status === "AUTHORIZED" &&
      (result?.response_code === 0 || result?.response_code === "0");

    if (!isAuthorized) {
      return redirectTo(
        request,
        `/payment/webpay/result?status=failed&token=${encodeURIComponent(token)}`
      );
    }

    // Guardar pago en DB
    const order = await finalizeTicketPurchase(result.session_id, result);

    return redirectTo(
      request,
      `/payment/webpay/result?status=success&orderId=${encodeURIComponent(order.id)}`
    );
  } catch (err) {
    console.error("Webpay return error:", err);
    return redirectTo(
      request,
      `/payment/webpay/result?status=error&reason=${encodeURIComponent(err?.message || "unknown")}`
    );
  }
}

