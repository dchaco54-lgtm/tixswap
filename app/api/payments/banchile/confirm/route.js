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

async function safeUpdateOrder(admin, orderId, patch, fallbackPatch) {
  const { error } = await admin.from("orders").update(patch).eq("id", orderId);
  if (!error) return null;

  if (fallbackPatch) {
    const { error: e2 } = await admin.from("orders").update(fallbackPatch).eq("id", orderId);
    if (!e2) return null;
    return e2;
  }

  return error;
}

export async function POST(req) {
  try {
    const admin = supabaseAdmin();

    const token = getBearerToken(req);
    if (!token) return NextResponse.json({ error: "No autenticado." }, { status: 401 });

    const { data: userRes, error: uErr } = await admin.auth.getUser(token);
    const user = userRes?.user;
    if (uErr || !user) return NextResponse.json({ error: "No autenticado." }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { orderId } = body;
    if (!orderId) return NextResponse.json({ error: "Falta orderId" }, { status: 400 });

    const { data: order, error: oErr } = await admin
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .single();

    if (oErr || !order) return NextResponse.json({ error: "Orden no encontrada." }, { status: 404 });
    if (order.buyer_id && order.buyer_id !== user.id)
      return NextResponse.json({ error: "No autorizado." }, { status: 403 });

    const requestId = order.payment_request_id;
    if (!requestId) {
      return NextResponse.json(
        {
          error:
            "Orden sin payment_request_id. Tu tabla orders necesita esa columna para confirmar el pago.",
          sql_fix:
            "alter table public.orders add column if not exists payment_request_id text;",
        },
        { status: 400 }
      );
    }

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

    const resp = await fetch(`${baseUrl}/api/session/${encodeURIComponent(requestId)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ auth }),
    });

    const j = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      return NextResponse.json(
        { error: "No se pudo consultar el estado del pago.", details: j },
        { status: 502 }
      );
    }

    const state = j?.status?.status || j?.state || "PENDING";

    // APPROVED
    if (state === "APPROVED") {
      // Orden -> paid (con fallback si no existe paid_at/payment_state)
      const updErr = await safeUpdateOrder(
        admin,
        orderId,
        {
          status: "paid",
          paid_at: new Date().toISOString(),
          payment_state: state,
        },
        { status: "paid" }
      );

      if (updErr) {
        return NextResponse.json(
          { error: "No se pudo actualizar la orden como pagada.", details: updErr.message },
          { status: 500 }
        );
      }

      // Ticket -> sold
      if (order.ticket_id) {
        await admin.from("tickets").update({ status: "sold" }).eq("id", order.ticket_id);
      }

      return NextResponse.json({ ok: true, state: "APPROVED" });
    }

    // REJECTED
    if (state === "REJECTED") {
      const updErr = await safeUpdateOrder(
        admin,
        orderId,
        { status: "rejected", payment_state: state },
        { status: "rejected" }
      );

      // liberar ticket si estaba held
      if (order.ticket_id) {
        await admin.from("tickets").update({ status: "active" }).eq("id", order.ticket_id);
      }

      if (updErr) {
        return NextResponse.json(
          { error: "Pago rechazado, pero falló actualizar la orden.", details: updErr.message },
          { status: 500 }
        );
      }

      return NextResponse.json({ ok: true, state: "REJECTED" });
    }

    // PENDING
    return NextResponse.json({ ok: true, state: "PENDING" });
  } catch (e) {
    console.error("banchile/confirm error:", e);
    return NextResponse.json({ error: "Error interno", details: e?.message || String(e) }, { status: 500 });
  }
}
