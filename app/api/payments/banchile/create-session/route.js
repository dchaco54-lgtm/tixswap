export const runtime = "nodejs";

// app/api/payments/banchile/create-session/route.js
import { NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getFees } from "@/lib/fees";

function getBearerToken(req) {
  const h = req.headers.get("authorization") || "";
  if (!h.toLowerCase().startsWith("bearer ")) return null;
  return h.slice(7).trim();
}

function buildAuth(login, secretKey) {
  const seed = new Date().toISOString();
  const nonceBytes = crypto.randomBytes(16);
  const nonce = nonceBytes.toString("base64");

  // tranKey = base64( sha256( nonceBytes + seed + secretKey ) )
  const sha = crypto.createHash("sha256");
  sha.update(Buffer.concat([nonceBytes, Buffer.from(seed), Buffer.from(secretKey)]));
  const tranKey = sha.digest("base64");

  return { login, tranKey, nonce, seed };
}

function getIp(req) {
  const xf = req.headers.get("x-forwarded-for");
  if (!xf) return "127.0.0.1";
  return xf.split(",")[0].trim();
}

export async function POST(req) {
  try {
    const admin = supabaseAdmin();

    // Auth (Bearer)
    const token = getBearerToken(req);
    if (!token) return NextResponse.json({ error: "No autenticado (sin token)." }, { status: 401 });

    const { data: userRes } = await admin.auth.getUser(token);
    const user = userRes?.user;
    if (!user) return NextResponse.json({ error: "No autenticado." }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { ticketId, returnUrl } = body;

    if (!ticketId) return NextResponse.json({ error: "Falta ticketId" }, { status: 400 });
    if (!returnUrl) return NextResponse.json({ error: "Falta returnUrl" }, { status: 400 });

    // Leer ticket
    const { data: ticket, error: tErr } = await admin
      .from("tickets")
      .select("id, event_id, seller_id, price, status, section, row, seat, notes")
      .eq("id", ticketId)
      .single();

    if (tErr || !ticket) return NextResponse.json({ error: "Ticket no encontrado" }, { status: 404 });
    if ((ticket.status || "active") !== "active")
      return NextResponse.json({ error: "Ticket no disponible" }, { status: 400 });

    if (ticket.seller_id === user.id)
      return NextResponse.json({ error: "No puedes comprar tu propio ticket" }, { status: 400 });

    // Fee + total
    const fees = getFees(ticket.price);
    const total = fees.total;

    // Crear orden
    const { data: order, error: oErr } = await admin
      .from("orders")
      .insert({
        ticket_id: ticket.id,
        buyer_id: user.id,
        seller_id: ticket.seller_id,
        amount: ticket.price,
        status: "pending",
      })
      .select("*")
      .single();

    if (oErr || !order) {
      return NextResponse.json(
        { error: "No se pudo crear la orden", details: oErr?.message || String(oErr) },
        { status: 500 }
      );
    }

    // Construir returnUrl con orderId SIEMPRE
    const u = new URL(returnUrl);
    u.searchParams.set("orderId", order.id);

    // Credenciales banco
    const baseUrl = process.env.BANCHILE_BASE_URL || "https://checkout.banchilepagos.cl";
    const login = process.env.BANCHILE_LOGIN;
    const secretKey = process.env.BANCHILE_SECRET_KEY;

    if (!login || !secretKey) {
      return NextResponse.json(
        { error: "Faltan variables BANCHILE_LOGIN / BANCHILE_SECRET_KEY en Vercel." },
        { status: 500 }
      );
    }

    const auth = buildAuth(login, secretKey);

    const payload = {
      auth,
      locale: "es_CL",
      buyer: {
        name: "Cliente",
        surname: "TixSwap",
        email: user.email || "no-email@tixswap.cl",
      },
      payment: {
        reference: order.id,
        description: "Compra de entrada en TixSwap",
        amount: { currency: "CLP", total },
      },
      expiration: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      ipAddress: getIp(req),
      userAgent: req.headers.get("user-agent") || "unknown",
      returnUrl: u.toString(),
    };

    const resp = await fetch(`${baseUrl}/api/session/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const j = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      console.error("Banchile create-session error:", resp.status, j);
      return NextResponse.json(
        { error: "No se pudo crear sesión de pago en Banchile.", details: j },
        { status: 502 }
      );
    }

    const requestId = j?.requestId || j?.request_id;
    const processUrl = j?.processUrl || j?.process_url;

    if (!requestId || !processUrl) {
      console.error("Banchile create-session response raro:", j);
      return NextResponse.json(
        { error: "Respuesta inválida del banco (sin requestId/processUrl).", details: j },
        { status: 502 }
      );
    }

    // Guardar requestId y “reservar” ticket (held)
    await admin.from("orders").update({
      payment_request_id: requestId,
      payment_provider: "banchile",
      total_paid_clp: total,
    }).eq("id", order.id);

    await admin.from("tickets").update({ status: "held" }).eq("id", ticket.id);

    return NextResponse.json({
      ok: true,
      orderId: order.id,
      requestId,
      redirectUrl: processUrl,
    });
  } catch (e) {
    console.error("banchile/create-session error:", e);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
