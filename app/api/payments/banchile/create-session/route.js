import crypto from "crypto";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { calcFees } from "@/lib/fees";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getClientIp(req) {
  const fwd = req.headers.get("x-forwarded-for");
  if (!fwd) return null;
  return fwd.split(",")[0].trim();
}

function generateAuth(login, secretKey) {
  const seed = new Date().toISOString();
  const rawNonce = Math.floor(Math.random() * 1_000_000).toString();

  const tranKey = crypto
    .createHash("sha256")
    .update(rawNonce + seed + secretKey)
    .digest("base64");

  const nonce = Buffer.from(rawNonce).toString("base64");
  return { login, tranKey, nonce, seed };
}

async function columnExists(table, column) {
  const { data, error } = await supabaseAdmin
    .from("information_schema.columns")
    .select("column_name")
    .eq("table_schema", "public")
    .eq("table_name", table)
    .eq("column_name", column)
    .maybeSingle();

  if (error) return false;
  return !!data;
}

function pickColumns(payload, allowed) {
  const out = {};
  for (const k of Object.keys(payload)) {
    if (allowed.includes(k) && payload[k] !== undefined) out[k] = payload[k];
  }
  return out;
}

export async function POST(req) {
  try {
    const supabaseAuth = createRouteHandlerClient({ cookies });
    const { data: { user }, error: userErr } = await supabaseAuth.auth.getUser();
    if (userErr || !user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const ticketId = body?.ticketId;
    if (!ticketId) return NextResponse.json({ error: "Falta ticketId" }, { status: 400 });

    // Ticket
    const { data: ticket, error: tErr } = await supabaseAdmin
      .from("tickets")
      .select("id,event_id,seller_id,status,price_CLP")
      .eq("id", ticketId)
      .maybeSingle();

    if (tErr || !ticket) return NextResponse.json({ error: "Ticket no encontrado" }, { status: 404 });
    if (ticket.seller_id === user.id) return NextResponse.json({ error: "No puedes comprar tu propia entrada" }, { status: 400 });
    if (ticket.status && String(ticket.status).toLowerCase() !== "published") return NextResponse.json({ error: "Ticket no disponible" }, { status: 400 });

    const basePrice = Number(ticket.price_CLP || 0);
    if (!basePrice || basePrice < 100) return NextResponse.json({ error: "Precio inválido" }, { status: 400 });

    // Event (para release)
    const { data: event } = await supabaseAdmin
      .from("events")
      .select("id,starts_at,title,name")
      .eq("id", ticket.event_id)
      .maybeSingle();

    // Roles (buyer/seller)
    const [{ data: buyerProfile }, { data: sellerProfile }] = await Promise.all([
      supabaseAdmin.from("profiles").select("role").eq("id", user.id).maybeSingle(),
      supabaseAdmin.from("profiles").select("role").eq("id", ticket.seller_id).maybeSingle(),
    ]);

    const fees = calcFees({
      price_clp: basePrice,
      buyer_role: buyerProfile?.role ?? "default",
      seller_role: sellerProfile?.role ?? "default",
    });

    // Insert order (safe cols)
    const candidateCols = [
      "ticket_id","event_id","buyer_id","seller_id","status",
      "amount_clp","buyer_fee_rate","seller_fee_rate",
      "buyer_fee_clp","seller_fee_clp","platform_fee_clp",
      "total_paid_clp","seller_payout_clp","event_starts_at",
      "payment_provider","payment_request_id","payment_state",
      "paid_at","payment_raw"
    ];

    const allowedCols = [];
    for (const col of candidateCols) {
      // eslint-disable-next-line no-await-in-loop
      if (await columnExists("orders", col)) allowedCols.push(col);
    }

    const orderPayload = {
      ticket_id: ticket.id,
      event_id: ticket.event_id,
      buyer_id: user.id,
      seller_id: ticket.seller_id,
      status: "payment_pending",
      amount_clp: fees.price_clp,
      buyer_fee_rate: fees.buyer_fee_rate,
      seller_fee_rate: fees.seller_fee_rate,
      buyer_fee_clp: fees.buyer_fee_clp,
      seller_fee_clp: fees.seller_fee_clp,
      platform_fee_clp: fees.platform_fee_clp,
      total_paid_clp: fees.total_paid_clp,
      seller_payout_clp: fees.seller_payout_clp,
      event_starts_at: event?.starts_at ?? null,
      payment_provider: "banchile_webcheckout",
      payment_state: "PENDING",
    };

    const { data: order, error: oErr } = await supabaseAdmin
      .from("orders")
      .insert(pickColumns(orderPayload, allowedCols))
      .select("*")
      .single();

    if (oErr || !order) return NextResponse.json({ error: "No pudimos crear orden", details: oErr?.message }, { status: 500 });

    // Reservar ticket
    await supabaseAdmin.from("tickets").update({ status: "reserved" }).eq("id", ticket.id);

    // Banchile session
    const baseUrl = process.env.BANCHILE_BASE_URL || "https://checkout.test.banchilepagos.cl";
    const login = process.env.BANCHILE_LOGIN;
    const secretKey = process.env.BANCHILE_SECRET_KEY;
    if (!login || !secretKey) {
      await supabaseAdmin.from("tickets").update({ status: "published" }).eq("id", ticket.id);
      return NextResponse.json({ error: "Faltan env vars BANCHILE_LOGIN / BANCHILE_SECRET_KEY" }, { status: 500 });
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || (req.headers.get("origin") ?? "https://tixswap.cl");
    const returnUrl = `${siteUrl}/payment/return?orderId=${order.id}`;
    const expiration = new Date(Date.now() + 30 * 60 * 1000).toISOString();

    const auth = generateAuth(login, secretKey);
    const payload = {
      auth,
      locale: "es_CL",
      payment: {
        reference: String(order.id),
        description: `Compra TixSwap - Orden ${order.id}`,
        amount: { currency: "CLP", total: fees.total_paid_clp },
      },
      expiration,
      returnUrl,
      ipAddress: getClientIp(req) || "127.0.0.1",
      userAgent: req.headers.get("user-agent") || "TixSwap",
    };

    const r = await fetch(`${baseUrl}/api/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await r.json().catch(() => null);
    if (!r.ok || !data?.processUrl || !data?.requestId) {
      await supabaseAdmin.from("tickets").update({ status: "published" }).eq("id", ticket.id);
      await supabaseAdmin.from("orders").update({ status: "payment_error", payment_raw: data ?? null }).eq("id", order.id);
      return NextResponse.json({ error: "No se pudo crear sesión Banchile", details: data }, { status: 502 });
    }

    await supabaseAdmin.from("orders").update({
      status: "payment_initiated",
      payment_request_id: data.requestId,
      payment_raw: data,
    }).eq("id", order.id);

    return NextResponse.json({
      orderId: order.id,
      processUrl: data.processUrl,
      amount: fees.total_paid_clp,
      breakdown: fees,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Error inesperado creando pago" }, { status: 500 });
  }
}
