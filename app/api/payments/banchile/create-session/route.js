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

function isPendingLike(status) {
  const s = (status ?? "").toString().toLowerCase().trim();
  return ["pending", "created", "initiated", "processing"].includes(s);
}

function extractMissingColumn(msg = "") {
  // Supabase/PostgREST styles
  let m =
    msg.match(/Could not find the '([^']+)' column/i) ||
    msg.match(/column "([^"]+)" does not exist/i);
  return m ? m[1] : null;
}

function extractNotNullColumn(msg = "") {
  const m = msg.match(/null value in column "([^"]+)"/i);
  return m ? m[1] : null;
}

function guessValueForColumn(col, ctx) {
  const c = col.toLowerCase();

  // ids
  if (c.includes("ticket")) return ctx.ticketId;
  if (c.includes("buyer")) return ctx.buyerId;
  if (c.includes("seller")) return ctx.sellerId;

  // money
  if (c.includes("total") && c.includes("amount")) return ctx.total;
  if (c.includes("total") && c.includes("paid")) return ctx.total;
  if (c.includes("amount")) return ctx.amount;
  if (c.includes("fee")) return ctx.fee;

  // payment
  if (c.includes("provider")) return "banchile";
  if (c.includes("state")) return "created";
  if (c === "status") return "pending";

  // timestamps
  if (c.includes("created_at") || c.includes("updated_at")) return new Date().toISOString();

  // fallback
  return 0;
}

async function insertOrderHealing(admin, payload, ctx) {
  let current = { ...payload };

  for (let i = 0; i < 12; i++) {
    const { data, error } = await admin.from("orders").insert(current).select("*").single();
    if (!error) return { data };

    const msg = error.message || "";

    // 1) columna no existe -> la saco y reintento
    const missing = extractMissingColumn(msg);
    if (missing && Object.prototype.hasOwnProperty.call(current, missing)) {
      delete current[missing];
      continue;
    }

    // 2) NOT NULL -> intento setear algo razonable y reintento
    const notNullCol = extractNotNullColumn(msg);
    if (notNullCol) {
      if (current[notNullCol] === undefined || current[notNullCol] === null) {
        current[notNullCol] = guessValueForColumn(notNullCol, ctx);
        continue;
      }
    }

    // si no puedo “sanar”, devuelvo el error
    return { error };
  }

  return { error: new Error("No se pudo insertar orden (healing agotado).") };
}

async function safeUpdateHealing(admin, orderId, patch) {
  let current = { ...patch };

  for (let i = 0; i < 12; i++) {
    const { error } = await admin.from("orders").update(current).eq("id", orderId);
    if (!error) return { ok: true };

    const msg = error.message || "";
    const missing = extractMissingColumn(msg);
    if (missing && Object.prototype.hasOwnProperty.call(current, missing)) {
      delete current[missing];
      continue;
    }

    return { ok: false, error };
  }

  return { ok: false, error: new Error("No se pudo actualizar orden (healing agotado).") };
}

export async function POST(req) {
  const admin = supabaseAdmin();

  try {
    const token = getBearerToken(req);
    if (!token) return NextResponse.json({ error: "No autenticado (sin token)." }, { status: 401 });

    const { data: userRes, error: uErr } = await admin.auth.getUser(token);
    const user = userRes?.user;
    if (uErr || !user) return NextResponse.json({ error: "No autenticado." }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { ticketId, returnUrl } = body;

    if (!ticketId) return NextResponse.json({ error: "Falta ticketId" }, { status: 400 });
    if (!returnUrl) return NextResponse.json({ error: "Falta returnUrl" }, { status: 400 });

    // Ticket
    const { data: ticket, error: tErr } = await admin
      .from("tickets")
      .select("*")
      .eq("id", ticketId)
      .maybeSingle();

    if (tErr) return NextResponse.json({ error: "Error leyendo ticket", details: tErr.message }, { status: 500 });
    if (!ticket) return NextResponse.json({ error: "Ticket no encontrado" }, { status: 404 });

    if (ticket.seller_id && ticket.seller_id === user.id) {
      return NextResponse.json({ error: "No puedes comprar tu propio ticket" }, { status: 400 });
    }

    const ticketStatus = (ticket.status ?? "active").toString().toLowerCase().trim();
    if (["sold", "cancelled"].includes(ticketStatus)) {
      return NextResponse.json({ error: "Ticket no disponible" }, { status: 400 });
    }

    // Fees
    const fees = getFees(ticket.price);
    const total = fees.total;
    const fee = (fees.total ?? 0) - (fees.price ?? ticket.price ?? 0);

    // Buscar última orden (si existe la columna ticket_id; si no, no cortamos el flujo)
    let lastOrder = null;
    {
      const { data: existing, error: exErr } = await admin
        .from("orders")
        .select("id, status, buyer_id, created_at")
        .eq("ticket_id", ticket.id)
        .order("created_at", { ascending: false })
        .limit(1);

      if (!exErr && existing?.length) lastOrder = existing[0];
      // si exErr es por columna inexistente, igual seguimos (healing insert se encarga)
    }

    if (
      ticketStatus === "held" &&
      lastOrder &&
      lastOrder.buyer_id !== user.id &&
      isPendingLike(lastOrder.status)
    ) {
      return NextResponse.json(
        { error: "Este ticket está reservado por otro comprador (intenta más tarde)." },
        { status: 409 }
      );
    }

    // Reusar orden pendiente del mismo comprador
    let order = null;
    if (lastOrder && lastOrder.buyer_id === user.id && isPendingLike(lastOrder.status)) {
      const { data: full } = await admin.from("orders").select("*").eq("id", lastOrder.id).maybeSingle();
      order = full;
    }

    // Crear orden nueva (🔥 ahora incluye total_amount, que es tu NOT NULL)
    if (!order) {
      const ctx = {
        ticketId: ticket.id,
        buyerId: user.id,
        sellerId: ticket.seller_id ?? null,
        amount: ticket.price,
        total,
        fee,
      };

      // payload “superset” (si alguna columna no existe, healing la quita sola)
      const payload = {
        ticket_id: ticket.id,
        buyer_id: user.id,
        seller_id: ticket.seller_id ?? null,

        amount: ticket.price,
        total_amount: total,      // ✅ esta era la que faltaba (NOT NULL)
        fee_amount: fee,          // por si tu esquema la pide
        total_paid_clp: total,    // tu código viejo lo usa igual

        status: "pending",
        payment_provider: "banchile",
        payment_state: "created",
      };

      const ins = await insertOrderHealing(admin, payload, ctx);
      if (ins.error || !ins.data) {
        return NextResponse.json(
          { error: "No se pudo crear la orden", details: ins.error?.message || "insert failed" },
          { status: 500 }
        );
      }
      order = ins.data;
    }

    // Reservar ticket si estaba active
    if (ticketStatus === "active") {
      const { error: holdErr } = await admin
        .from("tickets")
        .update({ status: "held" })
        .eq("id", ticket.id)
        .eq("status", "active");

      if (holdErr) {
        return NextResponse.json({ error: "No se pudo reservar el ticket", details: holdErr.message }, { status: 409 });
      }
    }

    // Return URL con orderId
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

    const payloadBank = {
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
      body: JSON.stringify(payloadBank),
    });

    const j = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      await admin.from("tickets").update({ status: "active" }).eq("id", ticket.id);
      await safeUpdateHealing(admin, order.id, { status: "failed", payment_state: "failed" });

      return NextResponse.json(
        { error: "No se pudo crear sesión de pago en Banchile.", details: j },
        { status: 502 }
      );
    }

    const requestId = j?.requestId || j?.request_id;
    const processUrl = j?.processUrl || j?.process_url;

    if (!requestId || !processUrl) {
      await admin.from("tickets").update({ status: "active" }).eq("id", ticket.id);
      await safeUpdateHealing(admin, order.id, { status: "failed", payment_state: "failed" });

      return NextResponse.json(
        { error: "Respuesta inválida del banco (sin requestId/processUrl).", details: j },
        { status: 502 }
      );
    }

    // Guardar requestId (healing por si tu schema no tiene alguna de estas columnas)
    await safeUpdateHealing(admin, order.id, {
      payment_request_id: requestId,
      payment_provider: "banchile",
      payment_state: "processing",
      total_paid_clp: total,
      total_amount: total,
    });

    return NextResponse.json({
      ok: true,
      orderId: order.id,
      requestId,
      redirectUrl: processUrl,
    });
  } catch (e) {
    console.error("banchile/create-session error:", e);
    return NextResponse.json(
      { error: "Error interno", details: e?.message || String(e) },
      { status: 500 }
    );
  }
}

