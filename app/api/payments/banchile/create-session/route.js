export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { headers } from "next/headers";
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { calcFees, getFeeRatesForRole } from "@/lib/fees";

function isSingleNoRowError(err) {
  const msg = (err?.message || "").toLowerCase();
  return (
    err?.code === "PGRST116" ||
    msg.includes("0 rows") ||
    msg.includes("no rows") ||
    (msg.includes("json object requested") && msg.includes("0 rows"))
  );
}

function getIpFromHeaders() {
  const h = headers();
  const xff = h.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  const real = h.get("x-real-ip");
  if (real) return real.trim();
  return "127.0.0.1";
}

function getOriginFallback() {
  const h = headers();
  const proto = h.get("x-forwarded-proto") || "https";
  const host = h.get("x-forwarded-host") || h.get("host");
  if (!host) return "https://tixswap.cl";
  return `${proto}://${host}`;
}

function generateAuthHeader({ secretKey, login }) {
  const nonce = crypto.randomBytes(16).toString("hex");
  const seed = new Date().toISOString();
  const raw = `${nonce}${seed}${secretKey}`;
  const hash = crypto.createHash("sha256").update(raw).digest("base64");
  const token = Buffer.from(`${login}:${hash}`).toString("base64");
  return {
    auth: `Basic ${token}`,
    nonce,
    seed,
  };
}

async function columnExists(admin, table, column) {
  const { data, error } = await admin
    .from("information_schema.columns")
    .select("column_name")
    .eq("table_schema", "public")
    .eq("table_name", table)
    .eq("column_name", column)
    .maybeSingle();

  if (error) return false;
  return !!data;
}

export async function POST(req) {
  try {
    const admin = supabaseAdmin();

    const body = await req.json().catch(() => ({}));
    const ticketId = body?.ticketId;

    if (!ticketId) {
      return NextResponse.json({ error: "Falta ticketId." }, { status: 400 });
    }

    // 1) Trae ticket
    const { data: ticket, error: tErr } = await admin
      .from("tickets")
      .select("id, event_id, seller_id, price, status")
      .eq("id", ticketId)
      .single();

    if (tErr || !ticket) {
      console.error("banchile/create-session ticket query failed:", { ticketId, tErr });

      if (isSingleNoRowError(tErr) || !ticket) {
        return NextResponse.json({ error: "Ticket no encontrado." }, { status: 404 });
      }

      return NextResponse.json(
        {
          error: "No se pudo leer el ticket (service role).",
          details: tErr?.message || String(tErr),
        },
        { status: 500 }
      );
    }

    if (ticket.status !== "active") {
      return NextResponse.json(
        { error: `Ticket no disponible (status: ${ticket.status}).` },
        { status: 400 }
      );
    }

    // 2) Evento
    const { data: event } = await admin
      .from("events")
      .select("id, title")
      .eq("id", ticket.event_id)
      .maybeSingle();

    // buyer_id (ojo: aquí estabas usando lógica con cookies en versiones anteriores;
    // si tu flujo actual ya genera buyer en server, mantenlo. Si no, dime y lo ajustamos.)
    // Por ahora, lo dejo como "requiere buyer_id en body" para que no invente.
    const buyerId = body?.buyerId;
    if (!buyerId) {
      return NextResponse.json(
        { error: "Falta buyerId (usuario comprador) para crear la orden." },
        { status: 400 }
      );
    }

    const [{ data: buyerProfile }, { data: sellerProfile }] = await Promise.all([
      admin.from("profiles").select("role").eq("id", buyerId).maybeSingle(),
      admin.from("profiles").select("role").eq("id", ticket.seller_id).maybeSingle(),
    ]);

    const buyerRole = buyerProfile?.role || "standard";
    const sellerRole = sellerProfile?.role || "standard";

    const buyerRates = getFeeRatesForRole(buyerRole);
    const sellerRates = getFeeRatesForRole(sellerRole);

    const fees = calcFees({
      basePrice: ticket.price,
      buyerRate: buyerRates.buyerRate,
      sellerRate: sellerRates.sellerRate,
    });

    // 3) Reservar ticket
    const { data: reservedRows, error: rErr } = await admin
      .from("tickets")
      .update({ status: "pending" })
      .eq("id", ticketId)
      .eq("status", "active")
      .select("id");

    if (rErr || !reservedRows || reservedRows.length === 0) {
      return NextResponse.json(
        { error: "No se pudo reservar el ticket (puede que alguien se te adelantó)." },
        { status: 409 }
      );
    }

    // 4) Crear orden
    const orderCols = {
      buyer_id: buyerId,
      seller_id: ticket.seller_id,
      ticket_id: ticket.id,
      event_id: ticket.event_id,
      status: "pending_payment",
      amount_clp: fees.basePrice,
      buyer_fee_rate: fees.buyerRate,
      seller_fee_rate: fees.sellerRate,
      buyer_fee_clp: fees.buyerFee,
      seller_fee_clp: fees.sellerFee,
      total_paid_clp: fees.totalToPay,
      seller_payout_clp: fees.sellerPayout,
      payment_provider: "banchile",
    };

    const allowed = {};
    for (const k of Object.keys(orderCols)) {
      // eslint-disable-next-line no-await-in-loop
      const ok = await columnExists(admin, "orders", k);
      if (ok) allowed[k] = orderCols[k];
    }

    const { data: order, error: oErr } = await admin
      .from("orders")
      .insert(allowed)
      .select("*")
      .single();

    if (oErr || !order) {
      await admin.from("tickets").update({ status: "active" }).eq("id", ticketId);
      return NextResponse.json({ error: "No se pudo crear la orden." }, { status: 500 });
    }

    // 5) Crear sesión en Banchile
    const baseUrl = process.env.BANCHILE_BASE_URL || "https://checkout.banchilepagos.cl";
    const login = process.env.BANCHILE_LOGIN;
    const secretKey = process.env.BANCHILE_SECRET_KEY;

    if (!login || !secretKey) {
      await admin.from("orders").update({ status: "rejected" }).eq("id", order.id);
      await admin.from("tickets").update({ status: "active" }).eq("id", ticketId);
      return NextResponse.json(
        { error: "Faltan variables BANCHILE_LOGIN / BANCHILE_SECRET_KEY." },
        { status: 500 }
      );
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || getOriginFallback();
    const returnUrl = `${siteUrl}/payment/return?order=${encodeURIComponent(order.id)}`;

    const ipAddress = getIpFromHeaders();
    const ua = headers().get("user-agent") || "TixSwap";

    const expiration = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    const { auth } = generateAuthHeader({ secretKey, login });

    const payload = {
      locale: "es_CL",
      payment: {
        reference: order.id,
        description: `TixSwap - ${event?.title || "Compra de entrada"}`,
        amount: { currency: "CLP", total: fees.totalToPay },
      },
      expiration,
      returnUrl,
      ipAddress,
      userAgent: ua,
    };

    const resp = await fetch(`${baseUrl}/api/session`, {
      method: "POST",
      headers: {
        Authorization: auth,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const respJson = await resp.json().catch(() => ({}));

    if (!resp.ok) {
      console.error("Banchile create-session error:", resp.status, respJson);
      await admin.from("orders").update({ status: "rejected" }).eq("id", order.id);
      await admin.from("tickets").update({ status: "active" }).eq("id", ticketId);
      return NextResponse.json(
        { error: "Banchile rechazó la creación de sesión.", details: respJson },
        { status: 502 }
      );
    }

    const requestId = respJson?.requestId;
    const processUrl = respJson?.processUrl;

    const updates = { status: "payment_initiated" };
    if (await columnExists(admin, "orders", "payment_request_id")) {
      updates.payment_request_id = requestId;
    }
    if (await columnExists(admin, "orders", "payment_process_url")) {
      updates.payment_process_url = processUrl;
    }

    await admin.from("orders").update(updates).eq("id", order.id);

    return NextResponse.json({
      ok: true,
      orderId: order.id,
      requestId,
      processUrl,
      fees,
    });
  } catch (e) {
    console.error("create-session error:", e);
    return NextResponse.json({ error: "Error interno creando sesión." }, { status: 500 });
  }
}
