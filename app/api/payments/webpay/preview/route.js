// app/api/payments/webpay/preview/route.js
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getFees } from "@/lib/fees";

export const runtime = "nodejs";

function getBearer(req) {
  const h = req.headers.get("authorization") || "";
  if (!h.toLowerCase().startsWith("bearer ")) return null;
  return h.slice(7).trim();
}

export async function GET(req) {
  try {
    const token = getBearer(req);
    if (!token) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const ticketId = searchParams.get("ticketId");
    if (!ticketId) {
      return NextResponse.json({ error: "Falta ticketId" }, { status: 400 });
    }

    const admin = supabaseAdmin();

    // Validar usuario
    const { data: userRes, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userRes?.user?.id) {
      return NextResponse.json({ error: "Sesión inválida" }, { status: 401 });
    }

    // Ticket + evento
    const { data: ticket, error: tErr } = await admin
      .from("tickets")
      .select("id, price, price_clp, status, events(name)")
      .eq("id", ticketId)
      .single();

    if (tErr || !ticket) {
      return NextResponse.json({ error: "Ticket no encontrado" }, { status: 404 });
    }

    if (String(ticket.status).toLowerCase() !== "active") {
      return NextResponse.json({ error: "Este ticket no está disponible" }, { status: 409 });
    }

    const price = Number(ticket.price_clp ?? ticket.price ?? 0);
    const fees = getFees(price);

    return NextResponse.json({
      ticket,
      buyerFee: fees.buyerFee,
      total: fees.total,
      fee_rate_applied: fees.buyerRate,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Error interno preview" }, { status: 500 });
  }
}
