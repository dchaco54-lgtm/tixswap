// app/api/payments/webpay/create-session/route.js
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getFees } from "@/lib/fees";
import { getWebpayTransaction } from "@/lib/webpay";

export const runtime = "nodejs";

function json(status, body) {
  return NextResponse.json(body, { status });
}

function getBearer(req) {
  const h = req.headers.get("authorization") || "";
  if (!h.toLowerCase().startsWith("bearer ")) return null;
  return h.slice(7).trim();
}

function safeHost() {
  return (
    process.env.SITE_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "https://tixswap.cl"
  ).replace(/\/$/, "");
}

function buildBuyOrder(orderId) {
  const compact = String(orderId).replace(/-/g, "");
  return `TSW-${compact.slice(0, 20)}`; // <= 26 chars aprox
}

export async function POST(req) {
  try {
    const token = getBearer(req);
    if (!token) return json(401, { error: "No autorizado" });

    const body = await req.json().catch(() => ({}));
    const ticketId = body?.ticketId;
    if (!ticketId) return json(400, { error: "Falta ticketId" });

    const admin = supabaseAdmin();
    const { data: userRes, error: userErr } = await admin.auth.getUser(token);
    const userId = userRes?.user?.id;
    if (userErr || !userId) return json(401, { error: "Sesión inválida" });

    const { data: ticket, error: tErr } = await admin
      .from("tickets")
      .select("id, price, status, event_id, seller_id")
      .eq("id", ticketId)
      .single();

    if (tErr || !ticket) return json(404, { error: "Ticket no encontrado" });
    if (String(ticket.status).toLowerCase() !== "active") {
      return json(409, { error: "Este ticket no está disponible." });
    }

    const price = Number(ticket.price) || 0;
    const fees = getFees(price);
    const total = Number(fees.total) || price;

    // Crear orden
    const { data: inserted, error: insErr } = await admin
      .from("orders")
      .insert({
        ticket_id: ticketId,
        buyer_id: userId,
        seller_id: ticket.seller_id || null,
        event_id: ticket.event_id || null,
        status: "pending",
        payment_provider: "webpay",
        payment_method: "webpay",
        payment_state: "pending",
        amount_clp: price,
        fees_clp: Number(fees.fee) || 0,
        total_amount: total,
        total_clp: total,
      })
      .select("id")
      .single();

    if (insErr || !inserted?.id) {
      return json(500, { error: "No se pudo crear la orden" });
    }

    const orderId = inserted.id;

    // Reservar ticket en held
    const { data: heldRows } = await admin
      .from("tickets")
      .update({ status: "held" })
      .eq("id", ticketId)
      .eq("status", "active")
      .select("id");

    if (!heldRows || heldRows.length === 0) {
      return json(409, { error: "Este ticket fue tomado por otra persona." });
    }

    const host = safeHost();
    const returnUrl = `${host}/api/payments/webpay/return`;
    const buyOrder = buildBuyOrder(orderId);
    const sessionId = orderId;

    const tx = getWebpayTransaction();

    // create() devuelve url + token
    const createRes = await tx.create(buyOrder, sessionId, total, returnUrl);

    const url = createRes?.url;
    const webpayToken = createRes?.token;

    if (!url || !webpayToken) {
      return json(500, { error: "Webpay no devolvió url/token" });
    }

    await admin
      .from("orders")
      .update({
        buy_order: buyOrder,
        session_id: sessionId,
        webpay_token: webpayToken,
      })
      .eq("id", orderId);

    return json(200, { url, token: webpayToken, orderId });
  } catch (e) {
    console.error(e);
    return json(500, { error: "Error interno creando pago" });
  }
}
