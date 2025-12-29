import crypto from "crypto";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function generateAuth(login, secretKey) {
  const seed = new Date().toISOString();
  const rawNonce = Math.floor(Math.random() * 1_000_000).toString();
  const tranKey = crypto.createHash("sha256").update(rawNonce + seed + secretKey).digest("base64");
  const nonce = Buffer.from(rawNonce).toString("base64");
  return { login, tranKey, nonce, seed };
}

function extractState(data) {
  const s = data?.status?.status;
  if (!s) return null;
  const upper = String(s).toUpperCase();
  if (upper === "OK") return "PENDING";
  return upper;
}

export async function POST(req) {
  try {
    const supabaseAuth = createRouteHandlerClient({ cookies });
    const { data: { user }, error: userErr } = await supabaseAuth.auth.getUser();
    if (userErr || !user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const orderId = body?.orderId;
    if (!orderId) return NextResponse.json({ error: "Falta orderId" }, { status: 400 });

    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("id,buyer_id,ticket_id,payment_request_id,status")
      .eq("id", orderId)
      .maybeSingle();

    if (!order) return NextResponse.json({ error: "Orden no existe" }, { status: 404 });
    if (order.buyer_id !== user.id) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

    const baseUrl = process.env.BANCHILE_BASE_URL || "https://checkout.test.banchilepagos.cl";
    const login = process.env.BANCHILE_LOGIN;
    const secretKey = process.env.BANCHILE_SECRET_KEY;
    if (!login || !secretKey) return NextResponse.json({ error: "Faltan env vars BANCHILE_*" }, { status: 500 });

    const auth = generateAuth(login, secretKey);
    const r = await fetch(`${baseUrl}/api/session/${order.payment_request_id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ auth }),
    });

    const data = await r.json().catch(() => null);
    if (!r.ok || !data) return NextResponse.json({ error: "No pudimos consultar estado", details: data }, { status: 502 });

    const state = extractState(data) || "PENDING";

    if (state === "APPROVED") {
      await supabaseAdmin.from("orders").update({
        status: "held",
        payment_state: "APPROVED",
        paid_at: new Date().toISOString(),
        payment_raw: data,
      }).eq("id", order.id);

      await supabaseAdmin.from("tickets").update({ status: "sold" }).eq("id", order.ticket_id);
    }

    if (state === "REJECTED") {
      await supabaseAdmin.from("orders").update({
        status: "payment_failed",
        payment_state: "REJECTED",
        payment_raw: data,
      }).eq("id", order.id);

      await supabaseAdmin.from("tickets").update({ status: "published" }).eq("id", order.ticket_id);
    }

    return NextResponse.json({ orderId: order.id, state });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Error inesperado confirmando pago" }, { status: 500 });
  }
}
