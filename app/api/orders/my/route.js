import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

// 1) Ranking: paid/AUTHORIZED primero, luego pending, luego el resto
function rankOrder(o) {
  const status = String(o?.status || "").toLowerCase();
  const pstate = String(o?.payment_state || "").toUpperCase();

  // top tier: pagado (o autorizado)
  if (status === "paid" || pstate === "AUTHORIZED") return 300;

  // pending (sesión creada, inició checkout)
  if (status === "pending" || pstate === "SESSION_CREATED" || pstate === "session_created")
    return 200;

  // basura / fallidas
  if (status === "cancelled" || status === "failed") return 0;

  // cualquier otra cosa intermedia
  return 100;
}

// 2) Dedupe por ticket_id: deja la “mejor” orden
function dedupeByTicketId(orders) {
  const best = new Map();

  for (const o of orders) {
    const key = o.ticket_id || o?.ticket?.id || o.id; // fallback por si acaso
    const prev = best.get(key);

    if (!prev) {
      best.set(key, o);
      continue;
    }

    const a = rankOrder(o);
    const b = rankOrder(prev);

    if (a > b) {
      best.set(key, o);
      continue;
    }
    if (a < b) continue;

    // empate: gana el más nuevo
    const ta = Date.parse(o.created_at || 0) || 0;
    const tb = Date.parse(prev.created_at || 0) || 0;
    if (ta > tb) best.set(key, o);
  }

  // ordena newest first
  return Array.from(best.values()).sort(
    (x, y) => (Date.parse(y.created_at || 0) || 0) - (Date.parse(x.created_at || 0) || 0)
  );
}

export async function GET() {
  try {
    const supabase = createRouteHandlerClient({ cookies });

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    const user = userData?.user;

    if (userErr || !user) {
      // ojo: devolvemos vacío pero OK, para que el front no se muera
      return NextResponse.json({ orders: [] }, { status: 200 });
    }

    // IMPORTANTE:
    // NO intentes orders -> events directo (te tira "relationship orders & events").
    // Haz orders -> ticket (ticket_id) y ticket -> event (event_id).
    const { data: ordersRaw, error } = await supabase
      .from("orders")
      .select(
        `
        id,
        ticket_id,
        listing_id,
        buyer_id,
        user_id,
        seller_id,
        status,
        payment_state,
        created_at,
        updated_at,
        paid_at,
        buy_order,
        session_id,
        webpay_token,
        total_clp,
        amount_clp,
        fee_clp,
        currency,
        ticket:ticket_id (
          id,
          created_at,
          event_id,
          seller_id,
          seller_email,
          seller_name,
          sector,
          row_label,
          seat_label,
          section_label,
          price,
          original_price,
          sale_type,
          status,
          seller_rut,
          platform_fee,
          currency,
          event:event_id (
            id,
            title,
            category,
            venue,
            city,
            starts_at,
            image_url,
            created_at
          )
        )
      `
      )
      // por si en algunos flujos te queda buyer_id o user_id, cubrimos ambos
      .or(`buyer_id.eq.${user.id},user_id.eq.${user.id}`)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const orders = ordersRaw || [];

    // dedupe
    const deduped = dedupeByTicketId(orders);

    // normaliza: deja `event` al nivel del order (como lo estabas viendo en Network)
    const normalized = deduped.map((o) => {
      const ticket = o.ticket || null;
      const event = ticket?.event || null;

      // evita duplicar event dentro de ticket si quieres
      const cleanTicket = ticket ? { ...ticket } : null;
      if (cleanTicket && "event" in cleanTicket) delete cleanTicket.event;

      return {
        ...o,
        ticket: cleanTicket,
        event,
      };
    });

    return NextResponse.json({ orders: normalized }, { status: 200 });
  } catch (e) {
    return NextResponse.json(
      { error: e?.message || "Unexpected error" },
      { status: 500 }
    );
  }
}



