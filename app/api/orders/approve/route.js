import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) throw new Error("Missing env: NEXT_PUBLIC_SUPABASE_URL");
  if (!serviceKey) throw new Error("Missing env: SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

export async function POST(req) {
  try {
    const supabase = getSupabaseAdmin();

    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

    const { data: uData, error: uErr } = await supabase.auth.getUser(token);
    if (uErr || !uData?.user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    const user = uData.user;

    const body = await req.json().catch(() => ({}));
    const order_id = body?.order_id;
    if (!order_id) return NextResponse.json({ error: "Falta order_id" }, { status: 400 });

    // Validar que sea el buyer
    const { data: order, error: oErr } = await supabase
      .from("orders")
      .select("id,buyer_id,status,release_at,event_starts_at")
      .eq("id", order_id)
      .single();

    if (oErr || !order) return NextResponse.json({ error: "Orden no encontrada" }, { status: 404 });
    if (order.buyer_id !== user.id) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    if (order.status === "disputed") return NextResponse.json({ error: "Orden en disputa" }, { status: 400 });

    // Cooldown 24h desde aprobación
    const now = new Date();
    const cooldown = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    // release_at debe ser el mayor entre: release_at existente y cooldown (para no acortar si ya estaba más lejos)
    const currentRelease = order.release_at ? new Date(order.release_at) : null;
    const nextRelease = currentRelease && currentRelease > cooldown ? currentRelease : cooldown;

    const { error: upErr } = await supabase
      .from("orders")
      .update({
        status: "buyer_ok",
        buyer_ok_at: now.toISOString(),
        release_at: nextRelease.toISOString(),
      })
      .eq("id", order_id);

    if (upErr) return NextResponse.json({ error: "DB error", details: upErr.message }, { status: 500 });

    return NextResponse.json({ ok: true, release_at: nextRelease.toISOString() });
  } catch (e) {
    return NextResponse.json({ error: "Server error", details: e?.message || String(e) }, { status: 500 });
  }
}
