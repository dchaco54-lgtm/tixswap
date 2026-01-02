export const runtime = "nodejs";

// app/api/payments/banchile/confirm/route.js
import { NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function getBearerToken(req) {
  const h = req.headers.get("authorization") || "";
  if (!h.toLowerCase().startsWith("bearer ")) return null;
  return h.slice(7).trim();
}

function buildAuth(login, secretKey) {
  const seed = new Date().toISOString();
  const nonceBytes = crypto.randomBytes(16);
  const nonce = nonceBytes.toString("base64");

  const sha = crypto.createHash("sha256");
  sha.update(Buffer.concat([nonceBytes, Buffer.from(seed), Buffer.from(secretKey)]));
  const tranKey = sha.digest("base64");

  return { login, tranKey, nonce, seed };
}

export async function POST(req) {
  try {
    const admin = supabaseAdmin();

    // Bearer auth
    const token = getBearerToken(req);
    if (!token) return NextResponse.json({ error: "No autenticado (sin token)." }, { status: 401 });

    const { data: userRes } = await admin.auth.getUser(token);
    const user = userRes?.user;
    if (!user) return NextResponse.json({ error: "No autenticado." }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const orderId = body?.orderId;
    if (!orderId) return NextResponse.json({ error: "Falta orderId." }, { status: 400 });

    const { data: order, error: oErr } = await admin
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .single();

    if (oErr || !order) return NextResponse.json({ error: "Orden no encontrada." }, { status: 404 });
    if (order.buyer_id && order.buyer_id !== user.id)
      return NextResponse.json({ error: "No autorizado." }, { status: 403 });

    const baseUrl = process.env.BANCHILE_BASE_URL || "https://checkout.banchilepagos.cl";
    const login = process.env.BANCHILE_LOGIN;
    const secretKey = process.env.BANCHILE_SECRET_KEY;

    if (!login || !secretKey) {
      return NextResponse.json(
        { error: "Faltan variables BANCHILE_LOGIN / BANCHILE_SECRET_KEY." },
        { status: 500 }
      );
    }

    const requestId = order.payment_request_id;
    if (!requestId) {
      return NextResponse.json(
        { error: "Orden sin payment_request_id (no se puede confirmar)." },
        { status: 400 }
      );
    }

    // OJO: En esta API la confirmación es POST /api/session/{requestId} con body {auth}
    const auth = buildAuth(login, secretKey);

    const resp = await fetch(`${baseUrl}/api/session/${encodeURIComponent(requestId)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ auth }),
    });

    const j = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      console.error("Banchile confirm error:", resp.status, j);
      return NextResponse.json(
        { error: "No se pudo confirmar con Banchile.", details: j },
        { status: 502 }
      );
    }

    // PlaceToPay-style: status.status suele ser APPROVED / REJECTED / PENDING
    const state = j?.status?.status || j?.state || "PENDING";
    const ticketId = order.ticket_id;

    if (state === "APPROVED") {
      await admin.from("orders").update({
        status: "paid",
        paid_at: new Date().toISOString(),
        payment_state: state,
      }).eq("id", orderId);

      if (ticketId) await admin.from("tickets").update({ status: "sold" }).eq("id", ticketId);

      return NextResponse.json({ ok: true, state, orderStatus: "paid" });
    }

    if (state === "REJECTED") {
      await admin.from("orders").update({
        status: "rejected",
        payment_state: state,
      }).eq("id", orderId);

      if (ticketId) await admin.from("tickets").update({ status: "active" }).eq("id", ticketId);

      return NextResponse.json({ ok: true, state, orderStatus: "rejected" });
    }

    // PENDING u otro
    await admin.from("orders").update({
      status: "pending",
      payment_state: state,
    }).eq("id", orderId);

    return NextResponse.json({ ok: true, state, orderStatus: "pending" });
  } catch (e) {
    console.error("confirm error:", e);
    return NextResponse.json({ error: "Error interno confirmando pago." }, { status: 500 });
  }
}
