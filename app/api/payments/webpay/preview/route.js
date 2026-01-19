import { NextResponse } from "next/server";
export const dynamic = 'force-dynamic';
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getFees } from "@/lib/fees";

// GET /api/payments/webpay/preview?ticketId=<uuid>
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const ticketId = searchParams.get("ticketId");

    if (!ticketId) {
      return NextResponse.json({ error: "Falta ticketId" }, { status: 400 });
    }

    const admin = supabaseAdmin();

    const { data: ticket, error: tErr } = await admin
      .from("tickets")
      .select("id, price, currency, seat, section, row, event_id, seller_id")
      .eq("id", ticketId)
      .single();

    if (tErr || !ticket) {
      return NextResponse.json({ error: "Ticket no encontrado" }, { status: 404 });
    }

    const { data: event, error: eErr } = await admin
      .from("events")
      .select("id, name, venue, city, date")
      .eq("id", ticket.event_id)
      .single();

    if (eErr || !event) {
      return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });
    }

    const { data: sellerProfile } = await admin
      .from("profiles")
      .select("seller_tier")
      .eq("id", ticket.seller_id)
      .maybeSingle();

    const fees = getFees(ticket.price, { sellerTier: sellerProfile?.seller_tier });
    const breakdown = {
      price: Number(ticket.price || 0),
      buyerFee: fees.platformFee,
      total: fees.totalDue,
      currency: ticket.currency || "CLP",
    };

    const webpayEnv = (process.env.WEBPAY_ENV || "integration").toLowerCase();
    const webpayEnabled =
      webpayEnv !== "production" ||
      (!!process.env.WEBPAY_COMMERCE_CODE && !!process.env.WEBPAY_API_KEY_SECRET);

    return NextResponse.json({
      ticket,
      event,
      fees,
      buyerFee: breakdown.buyerFee,
      total: breakdown.total,
      breakdown,
      providers: {
        webpay: { enabled: webpayEnabled, env: webpayEnv },
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
