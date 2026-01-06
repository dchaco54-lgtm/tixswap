// app/api/payments/webpay/preview/route.js
// Devuelve un resumen de compra (ticket + fees) para que el checkout renderice el detalle

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getFees } from "@/lib/fees";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const ticketId = searchParams.get("ticketId");

    if (!ticketId) {
      return NextResponse.json({ error: "ticketId requerido" }, { status: 400 });
    }

    const { data: ticket, error: ticketError } = await supabaseAdmin
      .from("tickets")
      .select("*")
      .eq("id", ticketId)
      .single();

    if (ticketError || !ticket) {
      return NextResponse.json({ error: "Ticket no encontrado" }, { status: 404 });
    }

    let event = null;
    if (ticket.event_id) {
      const { data: ev } = await supabaseAdmin
        .from("events")
        .select("*")
        .eq("id", ticket.event_id)
        .single();
      event = ev ?? null;
    }

    const basePrice = Number(ticket.price || 0);
    const fees = getFees(basePrice);

    const breakdown = {
      basePrice,
      buyerFee: fees.buyerFee,
      total: fees.total,
      buyerFeeRateApplied: fees.buyerFeeRateApplied,
      platformFeeRateApplied: fees.platformFeeRateApplied,
    };

    return NextResponse.json({ ticket, event, fees, breakdown });
  } catch (e) {
    return NextResponse.json(
      { error: "Error al obtener resumen", details: e?.message },
      { status: 500 }
    );
  }
}

