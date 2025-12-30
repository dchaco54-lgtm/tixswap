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

    // ✅ Auth por Bearer token
    const token = getBearerToken(req);
    if (!token) {
      return NextResponse.json({ error: "No autenticado (sin token)." }, { status: 401 });
    }

    const { data: userRes, error: uErr } = await admin.auth.getUser(token);
    const user = userRes?.user;

    if (uErr || !user) {
      return NextResponse.json({ error: "No autenticado." }, { status: 401 });
    }

    const body = await req.json();
    const { ticketId, returnUrl } = body;

    if (!ticketId) {
      return NextResponse.json({ error: "Falta ticketId" }, { status: 400 });
    }
    if (!returnUrl) {
      return NextResponse.json({ error: "Falta returnUrl" }, { status: 400 });
    }

    const buyerId = user.id;

    // 🔎 Leer ticket
    const { data: ticket, error: tErr } = await admin
      .from("tickets")
      .select("id, event_id, seller_id, price, status")
      .eq("id", ticketId)
      .single();

    if (tErr || !ticket) {
      return NextResponse.json({ error: "Ticket no encontrado" }, { status: 404 });
    }

    if (ticket.status && ticket.status !== "active") {
      return NextResponse.json({ error: "Ticket no disponible" }, { status: 400 });
    }

    if (ticket.seller_id === buyerId) {
      return NextResponse.json({ error: "No puedes comprar tu propio ticket" }, { status: 400 });
    }

    // ✅ Crea order en DB (si tu flujo lo usa)
    // (mantengo tu lógica, pero asegurando buyerId real)
    const { data: order, error: oErr } = await admin
      .from("orders")
      .insert({
        ticket_id: ticketId,
        buyer_id: buyerId,
        seller_id: ticket.seller_id,
        amount: ticket.price,
        status: "pending",
      })
      .select("*")
      .single();

    if (oErr || !order) {
      return NextResponse.json(
        { error: "No se pudo crear la orden", details: oErr?.message || String(oErr) },
        { status: 500 }
      );
    }

    // ---- BANCO DE CHILE / BANCHILE ----
    // OJO: aquí mantén TU implementación actual de llamada al banco
    // Yo no invento endpoints tuyos: solo te dejo el “orderId” y “returnUrl” listos.

    // Si tu implementación actual genera session/redirect, devuélvelo así:
    // return NextResponse.json({ redirectUrl });

    // Placeholder (para que no rompa si tú ya tenías esta parte abajo):
    return NextResponse.json({
      ok: true,
      orderId: order.id,
      // Si tu front espera redirectUrl, acá debe venir el real desde tu integración
      // redirectUrl: "https://...."
    });
  } catch (e) {
    console.error("banchile/create-session error:", e);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
