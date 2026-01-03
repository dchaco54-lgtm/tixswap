// app/api/payments/banchile/create-session/route.js
import { NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

const DEFAULT_TEST_BASE = "https://checkout.test.banchilepagos.cl";
const DEFAULT_PROD_BASE = "https://checkout.banchilepagos.cl";

function normalizeBaseUrl(raw) {
  // Si viene vacío, usamos modo (por defecto test)
  const mode = (process.env.BANCHILE_MODE || "test").toLowerCase();
  const fallback = mode === "prod" ? DEFAULT_PROD_BASE : DEFAULT_TEST_BASE;

  if (!raw) return fallback;

  let v = String(raw).trim();

  // Caso típico: lo dejaron literal por accidente
  if (v === "BANCHILE_BASE_URL") return fallback;

  // Si pega con /api/session, lo limpiamos (porque nosotros lo agregamos)
  v = v.replace(/\/api\/session\/?$/i, "");

  // Sacar trailing slash
  v = v.replace(/\/+$/, "");

  // Si no tiene protocolo, asumimos https
  if (!/^https?:\/\//i.test(v)) v = `https://${v}`;

  return v;
}

function generateAuth(login, secretKey) {
  const seed = new Date().toISOString();
  const nonceBytes = crypto.randomBytes(16);

  const tranKey = crypto
    .createHash("sha256")
    .update(Buffer.concat([nonceBytes, Buffer.from(seed), Buffer.from(secretKey)]))
    .digest("base64");

  const nonce = nonceBytes.toString("base64");

  return { login, tranKey, nonce, seed };
}

function expirationISO(minutes = 15) {
  return new Date(Date.now() + minutes * 60 * 1000).toISOString();
}

// Acepta "20.000", "20000", 20000
function parseCLP(val) {
  if (typeof val === "number") return Number.isFinite(val) ? Math.round(val) : 0;
  if (!val) return 0;
  const cleaned = String(val).replace(/[^\d]/g, ""); // deja solo dígitos
  const n = parseInt(cleaned || "0", 10);
  return Number.isFinite(n) ? n : 0;
}

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const { ticketId, returnUrl } = body;

    if (!ticketId) {
      return NextResponse.json({ error: "Falta ticketId." }, { status: 400 });
    }
    if (!returnUrl) {
      return NextResponse.json({ error: "Falta returnUrl." }, { status: 400 });
    }

    // Token del usuario (para amarrar orden al user)
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) {
      return NextResponse.json({ error: "No autorizado (sin token)." }, { status: 401 });
    }

    const { data: userRes, error: userErr } = await supabaseAdmin.auth.getUser(token);
    if (userErr || !userRes?.user?.id) {
      return NextResponse.json({ error: "No se pudo validar usuario." }, { status: 401 });
    }
    const userId = userRes.user.id;

    // Credenciales Banchile (SERVER ONLY)
    const BANCHILE_LOGIN = process.env.BANCHILE_LOGIN;
    const BANCHILE_SECRET_KEY = process.env.BANCHILE_SECRET_KEY;
    const baseUrl = normalizeBaseUrl(process.env.BANCHILE_BASE_URL);

    if (!BANCHILE_LOGIN || !BANCHILE_SECRET_KEY) {
      return NextResponse.json(
        {
          error:
            "Faltan credenciales Banchile en el servidor (BANCHILE_LOGIN / BANCHILE_SECRET_KEY). Revisa Vercel → Env Vars.",
        },
        { status: 500 }
      );
    }

    // 1) Buscar ticket
    const { data: ticket, error: ticketErr } = await supabaseAdmin
      .from("tickets")
      .select("id, event_id, price, amount, status, title")
      .eq("id", ticketId)
      .single();

    if (ticketErr || !ticket) {
      return NextResponse.json({ error: "Ticket no encontrado." }, { status: 404 });
    }

    // 2) Validar estado ticket
    if (ticket.status !== "active") {
      return NextResponse.json(
        { error: `Ticket no disponible (status: ${ticket.status}).` },
        { status: 409 }
      );
    }

    // 3) Reservar ticket (hold)
    // Si tu constraint NO acepta "held", cambia a "reserved" o ajusta el constraint.
    const { error: holdErr } = await supabaseAdmin
      .from("tickets")
      .update({ status: "held" })
      .eq("id", ticketId)
      .eq("status", "active");

    if (holdErr) {
      return NextResponse.json(
        { error: `No se pudo reservar el ticket — ${holdErr.message}` },
        { status: 500 }
      );
    }

    // 4) Reusar orden pendiente si existe
    const { data: existing, error: existingErr } = await supabaseAdmin
      .from("orders")
      .select("id, payment_request_id, status, payment_state")
      .eq("ticket_id", ticketId)
      .eq("user_id", userId)
      .eq("payment_state", "pending")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingErr) {
      return NextResponse.json(
        { error: `Error buscando orden existente — ${existingErr.message}` },
        { status: 500 }
      );
    }

    const amount = parseCLP(ticket.price ?? ticket.amount);
    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: "Monto inválido del ticket (price/amount)." },
        { status: 400 }
      );
    }

    const fee = Math.round(amount * 0.06);
    const total = amount + fee;

    let orderId = existing?.id;

    if (!orderId) {
      const { data: order, error: orderErr } = await supabaseAdmin
        .from("orders")
        .insert([
          {
            status: "created",
            payment_state: "pending",
            user_id: userId,
            ticket_id: ticketId,
            event_id: ticket.event_id,
            amount_clp: amount,
            fee_clp: fee,
            total_amount: total,
            currency: "CLP",
            payment_provider: "banchile",
          },
        ])
        .select("id")
        .single();

      if (orderErr || !order?.id) {
        return NextResponse.json(
          { error: `No se pudo crear la orden — ${orderErr?.message || "unknown"}` },
          { status: 500 }
        );
      }
      orderId = order.id;
    }

    // 5) Crear sesión en Banchile
    const auth = generateAuth(BANCHILE_LOGIN, BANCHILE_SECRET_KEY);

    const ipAddress =
      (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "127.0.0.1";
    const userAgent = req.headers.get("user-agent") || "TixSwap Web";

    const sessionUrl = new URL("/api/session", baseUrl).toString();

    const payload = {
      auth,
      locale: "es_CL",
      payment: {
        reference: String(orderId),
        description: ticket.title ? `Compra ticket: ${ticket.title}` : `Compra ticket ${ticketId}`,
        amount: {
          currency: "CLP",
          total,
        },
      },
      expiration: expirationISO(15),
      returnUrl,
      ipAddress,
      userAgent,
    };

    const r = await fetch(sessionUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
    });

    const j = await r.json().catch(() => ({}));

    if (!r.ok) {
      // Dejamos ticket en active otra vez (rollback best-effort)
      await supabaseAdmin.from("tickets").update({ status: "active" }).eq("id", ticketId);

      const msg =
        j?.status?.message ||
        j?.message ||
        `Banchile error HTTP ${r.status}`;
      return NextResponse.json({ error: msg, details: j }, { status: 502 });
    }

    const requestId = j?.requestId;
    const processUrl = j?.processUrl;

    if (!requestId || !processUrl) {
      // rollback
      await supabaseAdmin.from("tickets").update({ status: "active" }).eq("id", ticketId);
      return NextResponse.json(
        { error: "Respuesta Banchile incompleta (sin requestId/processUrl).", details: j },
        { status: 502 }
      );
    }

    // 6) Guardar requestId + processUrl en la orden
    const { error: updErr } = await supabaseAdmin
      .from("orders")
      .update({
        payment_request_id: requestId,
        payment_process_url: processUrl,
      })
      .eq("id", orderId);

    if (updErr) {
      return NextResponse.json(
        { error: `No se pudo actualizar la orden — ${updErr.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ orderId, requestId, processUrl }, { status: 200 });
  } catch (e) {
    return NextResponse.json(
      { error: `Error interno — ${e?.message || "unknown"}` },
      { status: 500 }
    );
  }
}

