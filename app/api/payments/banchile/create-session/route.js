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

export async function POST(req) {
  const admin = supabaseAdmin();

  try {
    // Auth
    const token = getBearerToken(req);
    if (!token) return NextResponse.json({ error: "No autenticado." }, { status: 401 });

    const { data: userRes, error: uErr } = await admin.auth.getUser(token);
    const user = userRes?.user;
    if (uErr || !user) return NextResponse.json({ error: "No autenticado." }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { ticketId, returnUrl } = body;

    if (!ticketId) return NextResponse.json({ error: "Falta ticketId" }, { status: 400 });
    if (!returnUrl) return NextResponse.json({ error: "Falta returnUrl" }, { status: 400 });

    // Leer ticket
    const { data: ticket, error: tErr } = await admin
      .from("tickets")
      .select("*")
      .eq("id", ticketId)
      .maybeSingle();

    if (tErr) {
      return NextResponse.json({ error: "Error leyendo ticket", details: tErr.message }, { status: 500 });
    }
    if (!ticket) {
      return NextResponse.json({ error: "Ticket no encontrado" }, { status: 404 });
    }

    // No comprar tu propio ticket
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

    // Buscar última orden (SIN pedir columnas que no existen)
    const { data: existing, error: exErr } = await admin
      .from("orders")
      .select("id, status, buyer_id, created_at")
      .eq("ticket_id", ticket.id)
      .order("created_at", { ascending: false })
      .limit(1);

    if (exErr) {
      return NextResponse.json({ error: "Error buscando orden existente", details: exErr.message }, { status: 500 });
    }

    const lastOrder = existing?.length ? existing[0] : null;

    // Si ticket está held y hay orden pendiente de OTRO => reservado
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
      const { data: full, error: readErr } = await admin
        .from("orders")
        .select("*")
        .eq("id", lastOrder.id)
        .maybeSingle();

      if (readErr) {
        return NextResponse.json({ error: "Error leyendo orden existente", details: readErr.message }, { status: 500 });
      }
      order = full;
    }

    // Crear orden nueva (MÍNIMA, sin columnas inventadas)
    if (!order) {
      const { data: created, error: oErr } = await admin
        .from("orders")
        .insert({
          ticket_id: ticket.id,
          buyer_id: user.id,
          seller_id: ticket.seller_id ?? null,
          amount: ticket.price,
          status: "pending",
        })
        .select("*")
        .single();

      if (oErr || !created) {
        return NextResponse.json(
          { error: "No se pudo crear la orden", details: oErr?.message || "insert failed" },
          { status: 500 }
        );
      }

      order = created;
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
      // liberar ticket y marcar orden failed
      await admin.from("tickets").update({ status: "active" }).eq("id", ticket.id);
      await admin.from("orders").update({ status: "failed" }).eq("id", order.id);

      return NextResponse.json(
        { error: "No se pudo crear sesión de pago en Banchile.", details: j },
        { status: 502 }
      );
    }

    const requestId = j?.requestId || j?.request_id;
    const processUrl = j?.processUrl || j?.process_url;

    if (!requestId || !processUrl) {
      await admin.from("tickets").update({ status: "active" }).eq("id", ticket.id);
      await admin.from("orders").update({ status: "failed" }).eq("id", order.id);

      return NextResponse.json(
        { error: "Respuesta inválida del banco (sin requestId/processUrl).", details: j },
        { status: 502 }
      );
    }

    // ✅ Guardar requestId (AQUÍ es donde hoy te falla si no existe la columna)
    const { error: updErr } = await admin
      .from("orders")
      .update({
        payment_request_id: requestId, // <-- NECESITA EXISTIR EN TU DB
      })
      .eq("id", order.id);

    if (updErr) {
      // rollback suave
      await admin.from("tickets").update({ status: "active" }).eq("id", ticket.id);
      await admin.from("orders").update({ status: "failed" }).eq("id", order.id);

      return NextResponse.json(
        {
          error:
            "Tu tabla orders NO tiene la columna payment_request_id. Agrégala en Supabase (SQL Editor).",
          details: updErr.message,
          sql_fix:
            "alter table public.orders add column if not exists payment_request_id text;",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      orderId: order.id,
      requestId,
      redirectUrl: processUrl,
    });
  } catch (e) {
    console.error("banchile/create-session error:", e);
    return NextResponse.json({ error: "Error interno", details: e?.message || String(e) }, { status: 500 });
  }
}

