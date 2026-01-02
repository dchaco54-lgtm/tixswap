// app/api/orders/my/route.js
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function getBearerToken(req) {
  const h = req.headers.get("authorization") || "";
  if (!h.toLowerCase().startsWith("bearer ")) return null;
  return h.slice(7).trim();
}

export async function GET(req) {
  try {
    const admin = supabaseAdmin();

    const token = getBearerToken(req);
    if (!token) return NextResponse.json({ error: "No autenticado." }, { status: 401 });

    const { data: userRes } = await admin.auth.getUser(token);
    const user = userRes?.user;
    if (!user) return NextResponse.json({ error: "No autenticado." }, { status: 401 });

    const { data, error } = await admin
      .from("orders")
      .select(`
        id, status, amount, total_paid_clp, created_at, paid_at, payment_state,
        ticket:ticket_id (
          id, price, section, row, seat, notes, status,
          event:events ( id, title, starts_at, venue, city )
        )
      `)
      .eq("buyer_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: "No se pudieron cargar las compras." }, { status: 500 });
    }

    return NextResponse.json({ orders: data || [] });
  } catch (e) {
    console.error("orders/my error:", e);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

