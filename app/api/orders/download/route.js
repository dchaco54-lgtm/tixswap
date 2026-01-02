// app/api/orders/download/route.js
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function getBearerToken(req) {
  const h = req.headers.get("authorization") || "";
  if (!h.toLowerCase().startsWith("bearer ")) return null;
  return h.slice(7).trim();
}

export async function POST(req) {
  try {
    const admin = supabaseAdmin();

    const token = getBearerToken(req);
    if (!token) return NextResponse.json({ error: "No autenticado." }, { status: 401 });

    const { data: userRes } = await admin.auth.getUser(token);
    const user = userRes?.user;
    if (!user) return NextResponse.json({ error: "No autenticado." }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const orderId = body?.orderId;
    if (!orderId) return NextResponse.json({ error: "Falta orderId" }, { status: 400 });

    const { data: order, error: oErr } = await admin
      .from("orders")
      .select("id, buyer_id, status, ticket_id")
      .eq("id", orderId)
      .single();

    if (oErr || !order) return NextResponse.json({ error: "Orden no encontrada" }, { status: 404 });
    if (order.buyer_id !== user.id) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    if (order.status !== "paid") return NextResponse.json({ error: "La orden no está pagada aún" }, { status: 400 });

    const { data: ticket, error: t
