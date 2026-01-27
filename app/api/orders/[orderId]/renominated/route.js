// app/api/orders/[orderId]/renominated/route.js
import { NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) throw new Error("Missing env: NEXT_PUBLIC_SUPABASE_URL");
  if (!serviceKey) throw new Error("Missing env: SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

export async function POST(req, { params }) {
  try {
    const supabase = getSupabaseAdmin();

    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

    const { data: uData, error: uErr } = await supabase.auth.getUser(token);
    if (uErr || !uData?.user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    const user = uData.user;

    const orderId = params?.orderId;
    if (!orderId) return NextResponse.json({ error: "Missing orderId" }, { status: 400 });

    const { data: order, error: oErr } = await supabase
      .from("orders")
      .select("id, seller_id, buyer_id, ticket_id")
      .eq("id", orderId)
      .single();

    if (oErr || !order) return NextResponse.json({ error: "ORDER_NOT_FOUND" }, { status: 404 });

    // Admin o seller
    const { data: prof } = await supabase
      .from("profiles")
      .select("user_type")
      .eq("id", user.id)
      .maybeSingle();

    const isAdmin = prof?.user_type === "admin" || user.email === "soporte@tixswap.cl";
    const isSeller = order.seller_id === user.id;

    if (!isAdmin && !isSeller) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }

    const form = await req.formData();
    const file = form.get("file");

    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "Falta el PDF renominado (file)." }, { status: 400 });
    }

    const buf = Buffer.from(await file.arrayBuffer());
    if (buf.slice(0, 4).toString() !== "%PDF") {
      return NextResponse.json({ error: "Debe ser un PDF válido." }, { status: 400 });
    }

    const bucket = "tickets";
    const path = `orders/${orderId}/renominated-${crypto.randomUUID()}.pdf`;

    const { error: upErr } = await supabase.storage.from(bucket).upload(path, buf, {
      contentType: "application/pdf",
      upsert: true,
    });

    if (upErr) {
      return NextResponse.json({ error: "Storage error", details: upErr.message }, { status: 500 });
    }

    const { error: updErr } = await supabase
      .from("orders")
      .update({
        renominated_storage_bucket: bucket,
        renominated_storage_path: path,
        renominated_uploaded_at: new Date().toISOString(),
      })
      .eq("id", orderId);

    if (updErr) {
      return NextResponse.json({ error: "DB error", details: updErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, orderId, bucket, path });
  } catch (e) {
    return NextResponse.json({ error: "Server error", details: e?.message || String(e) }, { status: 500 });
  }
}
