export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function generateAuthHeader({ secretKey, login }) {
  const nonce = crypto.randomBytes(16).toString("hex");
  const seed = new Date().toISOString();
  const raw = `${nonce}${seed}${secretKey}`;
  const hash = crypto.createHash("sha256").update(raw).digest("base64");
  const token = Buffer.from(`${login}:${hash}`).toString("base64");
  return { auth: `Basic ${token}` };
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
  const supabase = createRouteHandlerClient({ cookies });
  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes?.user;

  if (!user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const admin = supabaseAdmin();

  try {
    const body = await req.json().catch(() => ({}));
    const orderId = body?.orderId;

    if (!orderId) {
      return NextResponse.json({ error: "Falta orderId." }, { status: 400 });
    }

    const { data: order, error: oErr } = await admin
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .single();

    if (oErr || !order) {
      return NextResponse.json({ error: "Orden no encontrada." }, { status: 404 });
    }

    if (order.buyer_id && order.buyer_id !== user.id) {
      return NextResponse.json({ error: "No autorizado." }, { status: 403 });
    }

    const baseUrl =
      process.env.BANCHILE_BASE_URL || "https://checkout.banchilepagos.cl";
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

    const { auth } = generateAuthHeader({ secretKey, login });

    const resp = await fetch(`${baseUrl}/api/session/${encodeURIComponent(requestId)}`, {
      method: "GET",
      headers: { Authorization: auth },
    });

    const respJson = await resp.json().catch(() => ({}));

    if (!resp.ok) {
      console.error("Banchile confirm error:", resp.status, respJson);
      return NextResponse.json(
        { error: "No se pudo confirmar con Banchile.", details: respJson },
        { status: 502 }
      );
    }

    const state = respJson?.state; // APPROVED | REJECTED | PENDING (depende Banchile)
    const ticketId = order.ticket_id;

    // actualiza order + ticket
    if (state === "APPROVED") {
      const upd = { status: "held" };
      if (await columnExists(admin, "orders", "paid_at")) upd.paid_at = new Date().toISOString();
      if (await columnExists(admin, "orders", "payment_state")) upd.payment_state = state;

      await admin.from("orders").update(upd).eq("id", orderId);

      if (ticketId) {
        await admin.from("tickets").update({ status: "sold" }).eq("id", ticketId);
      }

      return NextResponse.json({ ok: true, state, orderStatus: "held" });
    }

    if (state === "REJECTED") {
      const upd = { status: "rejected" };
      if (await columnExists(admin, "orders", "payment_state")) upd.payment_state = state;

      await admin.from("orders").update(upd).eq("id", orderId);

      if (ticketId) {
        await admin.from("tickets").update({ status: "active" }).eq("id", ticketId);
      }

      return NextResponse.json({ ok: true, state, orderStatus: "rejected" });
    }

    // PENDING u otro estado -> revisión
    const upd = { status: "pending_review" };
    if (await columnExists(admin, "orders", "payment_state")) upd.payment_state = state || "PENDING";

    await admin.from("orders").update(upd).eq("id", orderId);

    return NextResponse.json({ ok: true, state: state || "PENDING", orderStatus: "pending_review" });
  } catch (e) {
    console.error("confirm error:", e);
    return NextResponse.json({ error: "Error interno confirmando pago." }, { status: 500 });
  }
}
