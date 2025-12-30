import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { calcFees, getFeeRatesForRole } from "@/lib/fees";

function isUuid(v) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    v || ""
  );
}

export async function GET(req) {
  try {
    const url = new URL(req.url);
    const ticketId = url.searchParams.get("ticketId");

    if (!ticketId) {
      return NextResponse.json({ error: "Falta ticketId." }, { status: 400 });
    }
    if (!isUuid(ticketId)) {
      return NextResponse.json({ error: "ticketId inválido." }, { status: 400 });
    }

    // ✅ Cliente con cookies (misma sesión que el front)
    const supabase = createRouteHandlerClient({ cookies });
    const { data: userRes, error: authErr } = await supabase.auth.getUser();
    const user = userRes?.user;

    if (authErr || !user) {
      return NextResponse.json({ error: "No autenticado." }, { status: 401 });
    }

    // ✅ OJO: aquí NO usamos service role.
    // Leemos el ticket como lo ve el mismo proyecto / RLS que tu front.
    const { data: ticket, error: tErr } = await supabase
      .from("tickets")
      .select("id, event_id, seller_id, price, sector, row, seat, status")
      .eq("id", ticketId)
      .single();

    if (tErr || !ticket) {
      return NextResponse.json(
        {
          error: "Ticket no encontrado.",
          // Esto te ayuda a cachar si fue RLS / env / lo que sea
          details: tErr?.message || null,
        },
        { status: 404 }
      );
    }

    // Permitimos comprar sólo si está activo
    if (ticket.status && !["active"].includes(ticket.status)) {
      return NextResponse.json(
        { error: `Ticket no disponible (status: ${ticket.status}).` },
        { status: 400 }
      );
    }

    const { data: event, error: eErr } = await supabase
      .from("events")
      .select("id, title, starts_at, venue, city")
      .eq("id", ticket.event_id)
      .single();

    if (eErr || !event) {
      return NextResponse.json(
        { error: "Evento no encontrado.", details: eErr?.message || null },
        { status: 404 }
      );
    }

    const [{ data: buyerProfile }, { data: sellerProfile }] = await Promise.all([
      supabase.from("profiles").select("role").eq("id", user.id).maybeSingle(),
      supabase.from("profiles").select("role").eq("id", ticket.seller_id).maybeSingle(),
    ]);

    const buyerRole = buyerProfile?.role || "standard";
    const sellerRole = sellerProfile?.role || "standard";

    const buyerRates = getFeeRatesForRole(buyerRole);
    const sellerRates = getFeeRatesForRole(sellerRole);

    const fees = calcFees({
      basePrice: ticket.price,
      buyerRate: buyerRates.buyerRate,
      sellerRate: sellerRates.sellerRate,
    });

    return NextResponse.json({
      ticket,
      event,
      roles: { buyerRole, sellerRole },
      fees,
    });
  } catch (e) {
    console.error("checkout/preview error:", e);
    return NextResponse.json(
      { error: "Error interno.", details: e?.message || null },
      { status: 500 }
    );
  }
}
