import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getFees } from "@/lib/fees";

// GET /api/payments/webpay/preview?ticketId=<uuid>
// Resumen (precio + comisión + total) y disponibilidad de proveedores.
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const ticketId = searchParams.get("ticketId");

    if (!ticketId) {
      return NextResponse.json({ error: "Falta ticketId" }, { status: 400 });
    }

    const { data: ticket, error: tErr } = await supabaseAdmin
      .from("tickets")
      .select("id, price, currency, seat, section, row, event_id, seller_id")
      .eq("id", ticketId)
      .single();

    if (tErr || !ticket) {
      return NextResponse.json({ error: "Ticket no encontrado" }, { status: 404 });
    }

    const { data: event, error: eErr } = await supabaseAdmin
      .from("events")
      .select("id, name, venue, city, date")
      .eq("id", ticket.event_id)
      .single();

    if (eErr || !event) {
      return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });
    }

    const fees = getFees(ticket.price);
    const serviceFee = fees.buyerFee;

    const breakdown = {
      price: Number(ticket.price || 0),
      buyerFee: serviceFee,
      total: Math.round(Number(ticket.price || 0) + serviceFee),
      currency: ticket.currency || "CLP",
    };

    // Flags de disponibilidad (para no dejar al usuario pegado si faltan creds)
    const webpayEnv = (process.env.WEBPAY_ENV || "integration").toLowerCase();
    const webpayEnabled =
      webpayEnv !== "production" ||
      (!!process.env.WEBPAY_COMMERCE_CODE && !!process.env.WEBPAY_API_KEY);

    const banchileEnabled = !!process.env.BANCHILE_LOGIN && !!process.env.BANCHILE_SECRET_KEY;

    return NextResponse.json({
      ticket,
      event,
      fees,
      serviceFee, // alias
      buyerFee: breakdown.buyerFee, // lo que el front espera
      total: breakdown.total, // lo que el front espera
      breakdown,
      providers: {
        webpay: { enabled: webpayEnabled, env: webpayEnv },
        banchile: { enabled: banchileEnabled, env: (process.env.BANCHILE_ENV || "test").toLowerCase() },
        mercadoPago: { enabled: false },
      },
    });
  } catch (err) {
    console.error("webpay/preview error:", err);
    return NextResponse.json(
      { error: err?.message || "Error obteniendo resumen" },
      { status: 500 }
    );
  }
}
