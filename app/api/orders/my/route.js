// app/api/orders/[orderId]/route.js
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

export const dynamic = "force-dynamic";

export async function GET(_req, { params }) {
  try {
    const supabase = createRouteHandlerClient({ cookies });

    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr) return Response.json({ error: userErr.message }, { status: 401 });
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const orderId = params?.orderId;

    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .select(
        "id, listing_id, buyer_id, user_id, seller_id, ticket_id, status, payment_state, payment_provider, created_at, updated_at, paid_at, buy_order, session_id, webpay_token, amount_clp, fee_clp, total_clp, total_amount, currency"
      )
      .eq("id", orderId)
      .maybeSingle();

    if (orderErr) return Response.json({ error: orderErr.message }, { status: 500 });
    if (!order) return Response.json({ error: "Not found" }, { status: 404 });

    // Seguridad: que sea del usuario logeado
    const isMine = order.buyer_id === user.id || order.user_id === user.id;
    if (!isMine) return Response.json({ error: "Forbidden" }, { status: 403 });

    // Ticket + Event
    let ticket = null;
    let event = null;

    if (order.ticket_id) {
      const { data: t, error: tErr } = await supabase
        .from("tickets")
        .select(
          "id, created_at, event_id, seller_id, seller_email, seller_name, seller_rut, sector, row_label, seat_label, price, original_price, sale_type, status, platform_fee, currency, section_label"
        )
        .eq("id", order.ticket_id)
        .maybeSingle();

      if (tErr) return Response.json({ error: tErr.message }, { status: 500 });
      ticket = t;

      if (ticket?.event_id) {
        const { data: e, error: eErr } = await supabase
          .from("events")
          .select("id, title, category, venue, city, starts_at, image_url, created_at")
          .eq("id", ticket.event_id)
          .maybeSingle();

        if (eErr) return Response.json({ error: eErr.message }, { status: 500 });
        event = e;
      }
    }

    return Response.json({ order: { ...order, ticket, event } }, { status: 200 });
  } catch (e) {
    return Response.json({ error: e?.message || "Unknown error" }, { status: 500 });
  }
}



