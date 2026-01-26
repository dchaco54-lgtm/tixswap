import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server"; // ajusta si tu path es otro

function getBearerToken(req) {
  const auth = req.headers.get("authorization") || "";
  const [type, token] = auth.split(" ");
  if (type?.toLowerCase() === "bearer" && token) return token.trim();
  return null;
}

function score(o) {
  // 1) pagado o autorizado gana siempre
  if (o.status === "paid" || o.payment_state === "AUTHORIZED") return 3;

  // 2) pending / sesión creada
  if (o.status === "pending" || o.payment_state === "session_created") return 2;

  // 3) otros estados “neutros”
  if (["processing", "created"].includes(o.status)) return 1;

  // 4) basura
  if (["cancelled", "failed", "expired"].includes(o.status)) return 0;

  return 1;
}

function dedupeOrdersByTicket(rows) {
  const best = new Map();

  for (const o of rows) {
    const key = o.ticket_id; // <-- CLAVE: por ticket_id

    // Si por alguna razón viene null, lo dejamos como “único”
    const safeKey = key || `no-ticket-${o.id}`;

    const curr = best.get(safeKey);
    const so = score(o);
    const sc = curr ? score(curr) : -1;

    const newer =
      !curr ||
      new Date(o.created_at).getTime() > new Date(curr.created_at).getTime();

    const better = !curr || so > sc || (so === sc && newer);

    if (better) best.set(safeKey, o);
  }

  // Oculta basura
  return Array.from(best.values()).filter(
    (o) => !["cancelled", "failed", "expired"].includes(o.status)
  );
}

export async function GET(req) {
  try {
    const token = getBearerToken(req);
    if (!token) {
      return NextResponse.json(
        { error: "No auth token provided" },
        { status: 401 }
      );
    }

    const supabase = createClient();

    // Validar usuario a partir del token
    const { data: userData, error: userErr } = await supabase.auth.getUser(
      token
    );

    if (userErr || !userData?.user?.id) {
      return NextResponse.json(
        { error: "Invalid session" },
        { status: 401 }
      );
    }

    const userId = userData.user.id;

    // Traer órdenes del usuario (buyer)
    // Ajusta el select si tus relaciones se llaman distinto (ticket/event)
    const { data: rows, error: qErr } = await supabase
      .from("orders")
      .select(
        `
        *,
        ticket:tickets (
          id,
          created_at,
          event_id,
          seller_id,
          seller_email,
          seller_name,
          title,
          description,
          sector,
          row_label,
          seat_label,
          price,
          original_price,
          sale_type,
          status,
          seller_rut,
          platform_fee,
          currency,
          section_label
        ),
        event:events (
          id,
          title,
          category,
          venue,
          city,
          starts_at,
          image_url,
          created_at
        )
      `
      )
      .eq("buyer_id", userId)
      .order("created_at", { ascending: false });

    if (qErr) {
      return NextResponse.json({ error: qErr.message }, { status: 500 });
    }

    const unique = dedupeOrdersByTicket(rows || []);

    return NextResponse.json({ orders: unique });
  } catch (e) {
    return NextResponse.json(
      { error: e?.message || "Internal error" },
      { status: 500 }
    );
  }
}



