import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { calcFees, getFeeRatesForRole } from "@/lib/fees";

function getBearerToken(req) {
  const h = req.headers.get("authorization") || "";
  if (!h.toLowerCase().startsWith("bearer ")) return null;
  return h.slice(7).trim();
}

function isSingleNoRowError(err) {
  const msg = (err?.message || "").toLowerCase();
  return (
    err?.code === "PGRST116" ||
    msg.includes("0 rows") ||
    msg.includes("no rows") ||
    (msg.includes("json object requested") && msg.includes("0 rows"))
  );
}

export async function GET(req) {
  try {
    const url = new URL(req.url);
    const ticketId = url.searchParams.get("ticketId");

    if (!ticketId) {
      return NextResponse.json({ error: "Falta ticketId." }, { status: 400 });
    }

    const admin = supabaseAdmin();

    // ✅ Auth por Bearer token (porque tu sesión está en localStorage)
    const token = getBearerToken(req);
    if (!token) {
      return NextResponse.json({ error: "No autenticado (sin token)." }, { status: 401 });
    }

    const { data: userRes, error: uErr } = await admin.auth.getUser(token);
    const user = userRes?.user;

    if (uErr || !user) {
      return NextResponse.json({ error: "No autenticado." }, { status: 401 });
    }

    // ✅ Leer ticket con service-role (evita RLS)
    const { data: ticket, error: tErr } = await admin
      .from("tickets")
      .select("id, event_id, seller_id, price, sector, row, seat, status")
      .eq("id", ticketId)
      .single();

    if (tErr || !ticket) {
      console.error("checkout/preview ticket query failed:", { ticketId, tErr });

      if (isSingleNoRowError(tErr) || !ticket) {
        return NextResponse.json({ error: "Ticket no encontrado." }, { status: 404 });
      }

      return NextResponse.json(
        {
          error: "No se pudo leer el ticket (service role).",
          details: tErr?.message || String(tErr),
        },
        { status: 500 }
      );
    }

    if (ticket.status && !["active"].includes(ticket.status)) {
      return NextResponse.json(
        { error: `Ticket no disponible (status: ${ticket.status}).` },
        { status: 400 }
      );
    }

    const { data: event, error: eErr } = await admin
      .from("events")
      .select("id, title, starts_at, venue, city")
      .eq("id", ticket.event_id)
      .single();

    if (eErr || !event) {
      return NextResponse.json({ error: "Evento no encontrado." }, { status: 404 });
    }

    const [{ data: buyerProfile }, { data: sellerProfile }] = await Promise.all([
      admin.from("profiles").select("role").eq("id", user.id).maybeSingle(),
      admin.from("profiles").select("role").eq("id", ticket.seller_id).maybeSingle(),
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
    return NextResponse.json({ error: "Error interno." }, { status: 500 });
  }
}


