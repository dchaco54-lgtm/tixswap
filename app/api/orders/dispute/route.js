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
    const reason = (body?.reason || "").trim();
    if (!order_id) return NextResponse.json({ error: "Falta order_id" }, { status: 400 });
    if (!reason) return NextResponse.json({ error: "Falta reason" }, { status: 400 });

    const { data: order, error: oErr } = await supabase
      .from("orders")
      .select("id,buyer_id,status")
      .eq("id", order_id)
      .single();

    if (oErr || !order) return NextResponse.json({ error: "Orden no encontrada" }, { status: 404 });
    if (order.buyer_id !== user.id) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    if (order.status === "paid_out") return NextResponse.json({ error: "Ya fue pagada al vendedor" }, { status: 400 });

    const now = new Date();
    const { error: upErr } = await supabase
      .from("orders")
      .update({
        status: "disputed",
        dispute_at: now.toISOString(),
        dispute_reason: reason,
      })
      .eq("id", order_id);

    if (upErr) return NextResponse.json({ error: "DB error", details: upErr.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: "Server error", details: e?.message || String(e) }, { status: 500 });
  }
}
