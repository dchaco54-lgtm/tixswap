import { NextResponse } from "next/server";
import crypto from "crypto";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getWebpayTransaction } from "@/lib/webpay";
import { normalizeTier, TIERS, getTierCommissionPercent } from "@/lib/tiers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function makeBuyOrder() {
  const ts = Date.now().toString(36);
  const rnd = Math.floor(Math.random() * 1e6).toString(36);
  return (`TS${ts}${rnd}`).toUpperCase().slice(0, 26);
}

function makeSessionId() {
  const raw = crypto.randomUUID().replace(/-/g, "");
  return `S${raw.slice(0, 20)}`;
}

function normalizeBaseUrl(url) {
  if (!url) return "";
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

function calcPlatformFee(ticketPrice, sellerTier = TIERS.BASIC) {
  const price = Math.round(Number(ticketPrice) || 0);
  const tier = normalizeTier(sellerTier || TIERS.BASIC);
  const commission = getTierCommissionPercent(tier);
  const fee = Math.round(price * commission);
  return { feeAmount: fee, totalAmount: price + fee };
}

async function getUserViaSupabaseRest(accessToken) {
  try {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const apiKey =
      process.env.SUPABASE_ANON_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !apiKey || !accessToken) return null;

    const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { apikey: apiKey, Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });

    if (!res.ok) return null;
    const user = await res.json().catch(() => null);
    return user && user.id ? user : null;
  } catch {
    return null;
  }
}

function pickTicketPrice(ticket) {
  const p = ticket?.price ?? ticket?.price_clp ?? ticket?.amount_clp ?? ticket?.amount ?? 0;
  return Math.max(0, Math.round(Number(p) || 0));
}

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const { ticketId } = body || {};
    if (!ticketId) return NextResponse.json({ error: "ticketId requerido" }, { status: 400 });

    const admin = supabaseAdmin();

    const authHeader = req.headers.get("authorization") || "";
    const accessToken = authHeader.toLowerCase().startsWith("bearer ")
      ? authHeader.slice(7).trim()
      : null;

    if (!accessToken) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    let user = null;

    if (admin?.auth?.getUser) {
      const { data, error } = await admin.auth.getUser(accessToken);
      if (!error) user = data?.user ?? null;
    }

    if (!user) user = await getUserViaSupabaseRest(accessToken);
    if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    // ✅ Trae price + price_clp por si tu DB tiene una u otra
    const { data: ticket, error: ticketError } = await admin
      .from("tickets")
      .select("id,status,price,price_clp,amount,amount_clp,seller_id,event_id")
      .eq("id", ticketId)
      .single();

    if (ticketError || !ticket) return NextResponse.json({ error: "Ticket no encontrado" }, { status: 404 });

    const st = String(ticket.status || "").toLowerCase();
    // ✅ acepta active/available
    if (!["active", "available"].includes(st)) {
      return NextResponse.json({ error: "Ticket no disponible" }, { status: 409 });
    }

    if (ticket.seller_id === user.id) {
      return NextResponse.json({ error: "No puedes comprar tu propio ticket" }, { status: 400 });
    }

    const { data: sellerProfile } = await admin
      .from("profiles")
      .select("seller_tier")
      .eq("id", ticket.seller_id)
      .maybeSingle();

    const sellerTier = normalizeTier(sellerProfile?.seller_tier || TIERS.BASIC);

    const amount = pickTicketPrice(ticket);
    const { feeAmount, totalAmount } = calcPlatformFee(amount, sellerTier);

    const buyOrder = makeBuyOrder();
    const sessionId = makeSessionId();

    // ✅ HOLD race-safe: si alguien ya lo tomó, no se actualiza ninguna fila
    const originalStatus = st;

    const { data: heldRows, error: holdError } = await admin
      .from("tickets")
      .update({ status: "held" })
      .eq("id", ticketId)
      .in("status", ["active", "available"])
      .select("id");

    if (holdError || !heldRows?.length) {
      return NextResponse.json(
        { error: "No se pudo reservar el ticket (puede que ya lo hayan tomado)" },
        { status: 409 }
      );
    }

    // Orden
    const { data: order, error: orderError } = await admin
      .from("orders")
      .insert({
        ticket_id: ticketId,
        user_id: user.id,
        seller_id: ticket.seller_id,
        buyer_id: user.id,
        buy_order: buyOrder,
        session_id: sessionId,
        amount_clp: amount,
        fee_clp: feeAmount,
        total_clp: totalAmount,
        payment_state: "created",
        status: "pending",
        payment_provider: "webpay",
        payment_method: "webpay",
        currency: "CLP",
      })
      .select("id")
      .single();

    if (orderError || !order) {
      // rollback hold al status original
      await admin.from("tickets").update({ status: originalStatus }).eq("id", ticketId).eq("status", "held");
      return NextResponse.json({ error: "No se pudo crear la orden" }, { status: 500 });
    }

    const baseUrl = normalizeBaseUrl(process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin);
    const returnUrl = `${baseUrl}/api/payments/webpay/return`;

    let result;
    try {
      const transaction = getWebpayTransaction();
      result = await transaction.create(buyOrder, sessionId, totalAmount, returnUrl);
    } catch (e) {
      await admin.from("tickets").update({ status: originalStatus }).eq("id", ticketId).eq("status", "held");
      await admin.from("orders").update({ payment_state: "failed", payment_status: "failed" }).eq("id", order.id);
      return NextResponse.json({ error: `Webpay error: ${e.message}` }, { status: 500 });
    }

    await admin
      .from("orders")
      .update({
        webpay_token: result.token,
        payment_process_url: result.url,
        payment_state: "session_created",
      })
      .eq("id", order.id);

    return NextResponse.json({ token: result.token, url: result.url }, { status: 200 });
  } catch (err) {
    return NextResponse.json({ error: "Error interno: " + (err?.message || "unknown") }, { status: 500 });
  }
}
