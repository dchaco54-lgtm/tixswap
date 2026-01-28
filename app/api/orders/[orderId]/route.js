import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { detectTicketColumns } from "@/lib/db/ticketSchema";

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
      const ticketCols = await detectTicketColumns(admin);
      let ticketSelect = "*";
      if (ticketCols && ticketCols.size) {
        ticketSelect = "id, event_id, sector, row_label, seat_label, section_label, price, original_price, sale_type, status, currency";
        if (ticketCols.has("ticket_upload_id")) ticketSelect += ", ticket_upload_id";
        if (ticketCols.has("ticket_uploads_id")) ticketSelect += ", ticket_uploads_id";
        if (ticketCols.has("is_nominated")) ticketSelect += ", is_nominated";
        if (ticketCols.has("is_nominada")) ticketSelect += ", is_nominada";
      }

      const { data: t, error: tErr } = await admin
        .from("tickets")
        .select(ticketSelect)
        .eq("id", order.ticket_id)
        .maybeSingle();

      if (tErr) console.error("GET /api/orders/[orderId] ticketErr", tErr);
      if (t) {
        const uploadId = t.ticket_upload_id || t.ticket_uploads_id;
        let upload = null;
        if (uploadId) {
          const { data: tu, error: tuErr } = await admin
            .from("ticket_uploads")
            .select("id, is_nominated, is_nominada")
            .eq("id", uploadId)
            .maybeSingle();
          if (tuErr) console.error("GET /api/orders/[orderId] uploadErr", tuErr);
          upload = tu || null;
        }
        const nominated = Boolean(
          t.is_nominated ??
          t.is_nominada ??
          upload?.is_nominated ??
          upload?.is_nominada ??
          false
        );
        ticket = { ...t, is_nominated: nominated };
      } else {
        ticket = null;
      }
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

    // 5) Traer buyer_name y buyer_rut (desde profiles)
    let buyer_name = null;
    let buyer_rut = null;
    const buyerId = order.buyer_id || order.user_id;
    if (buyerId) {
      try {
        const { data: buyerProfile, error: buyerErr } = await admin
          .from("profiles")
          .select("id, full_name, rut")
          .eq("id", buyerId)
          .maybeSingle();
        if (buyerErr) {
          console.error("GET /api/orders/[orderId] buyer profile join error", buyerErr);
        }
        if (buyerProfile) {
          buyer_name = buyerProfile.full_name || null;
          buyer_rut = buyerProfile.rut || null;
        }
      } catch (e) {
        console.error("GET /api/orders/[orderId] buyer profile join exception", e);
      }
    }

    return NextResponse.json({
      order: {
        ...order,
        ticket,
        event,
        buyer_name,
        buyer_rut,
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
