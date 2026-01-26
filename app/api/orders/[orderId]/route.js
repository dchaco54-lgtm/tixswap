import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Soporta 2 formas de auth:
// 1) Cookies (normal en el dashboard)
// 2) Bearer token (por si llamas desde cliente con access_token)
async function getUserFromRequest(req) {
  // A) Bearer token
  const auth = req.headers.get("authorization") || "";
  if (auth.startsWith("Bearer ")) {
    const token = auth.replace("Bearer ", "").trim();
    const admin = supabaseAdmin();
    const { data, error } = await admin.auth.getUser(token);
    if (!error && data?.user) return data.user;
  }

  // B) Cookies/session
  const cookieStore = cookies();
  const supabase = createClient(cookieStore);
  const { data } = await supabase.auth.getUser();
  return data?.user || null;
}

export async function GET(req, { params }) {
  try {
    const { orderId } = params;

    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const admin = supabaseAdmin();

    // 1) Buscar la orden (service role)
    const { data: order, error: orderErr } = await admin
      .from("orders")
      .select(
        `
        id,
        ticket_id,
        buyer_id,
        seller_id,
        user_id,
        status,
        payment_state,
        payment_provider,
        payment_method,
        created_at,
        updated_at,
        paid_at,
        amount_clp,
        fee_clp,
        total_clp,
        total_amount,
        currency,
        buy_order,
        session_id,
        webpay_token
      `
      )
      .eq("id", orderId)
      .maybeSingle();

    if (orderErr) {
      console.error("GET /api/orders/[orderId] orderErr", orderErr);
      return NextResponse.json(
        { error: "Error buscando la compra" },
        { status: 500 }
      );
    }

    if (!order) {
      return NextResponse.json(
        { error: "Compra no encontrada" },
        { status: 404 }
      );
    }

    // 2) Seguridad: solo comprador o vendedor
    const isBuyer = order.buyer_id === user.id || order.user_id === user.id;
    const isSeller = order.seller_id === user.id;

    if (!isBuyer && !isSeller) {
      return NextResponse.json(
        { error: "No tienes permisos para ver esta compra" },
        { status: 403 }
      );
    }

    // 3) Traer ticket
    let ticket = null;
    if (order.ticket_id) {
      const { data: t, error: tErr } = await admin
        .from("tickets")
        .select("*")
        .eq("id", order.ticket_id)
        .maybeSingle();

      if (tErr) console.error("GET /api/orders/[orderId] ticketErr", tErr);
      ticket = t || null;
    }

    // 4) Traer evento
    let event = null;
    const eventId = ticket?.event_id || order.event_id;
    if (eventId) {
      const { data: e, error: eErr } = await admin
        .from("events")
        .select("*")
        .eq("id", eventId)
        .maybeSingle();

      if (eErr) console.error("GET /api/orders/[orderId] eventErr", eErr);
      event = e || null;
    }

    return NextResponse.json({
      order: {
        ...order,
        ticket,
        event,
      },
    });
  } catch (err) {
    console.error("GET /api/orders/[orderId] fatal", err);
    return NextResponse.json(
      { error: "Error interno" },
      { status: 500 }
    );
  }
}

