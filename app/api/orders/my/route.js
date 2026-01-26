import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/* ===================== */
/* ===== Helpers ======= */
/* ===================== */

function getBearerToken(req) {
  const auth = req.headers?.get?.("authorization") || "";
  const [type, token] = auth.split(" ");
  if (type?.toLowerCase() === "bearer" && token) return token.trim();
  return null;
}

function createAuthedSupabase(token) {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const anon =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

  if (!url || !anon) throw new Error("Missing Supabase env vars (URL/ANON_KEY)");

  return createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: { Authorization: `Bearer ${token}` },
    },
  });
}

// Prioridad: paid/AUTHORIZED > pending/session_created > resto
function score(o) {
  if (o?.status === "paid" || o?.payment_state === "AUTHORIZED") return 30;
  if (o?.status === "pending" || o?.payment_state === "session_created")
    return 20;
  if (["created", "processing"].includes(o?.status)) return 10;
  if (["cancelled", "failed", "expired"].includes(o?.status)) return 0;
  return 10;
}

function dedupeByTicketId(rows) {
  const best = new Map();

  for (const o of rows || []) {
    const key = o?.ticket_id || `no-ticket-${o?.id}`;

    const curr = best.get(key);
    const so = score(o);
    const sc = curr ? score(curr) : -1;

    const tO = new Date(o?.created_at || 0).getTime();
    const tC = curr ? new Date(curr?.created_at || 0).getTime() : -1;

    const better = !curr || so > sc || (so === sc && tO > tC);
    if (better) best.set(key, o);
  }

  // Ocultar basura (opcional)
  return Array.from(best.values()).filter(
    (o) => !["cancelled", "failed", "expired"].includes(o?.status)
  );
}

/* ===================== */
/* ===== Endpoint ====== */
/* ===================== */

export async function GET(req) {
  try {
    const token = getBearerToken(req);
    if (!token) {
      return NextResponse.json(
        { error: "Missing Authorization Bearer token" },
        { status: 401 }
      );
    }

    const supabase = createAuthedSupabase(token);

    // user desde JWT (sin cookies)
    const { data: u, error: uErr } = await supabase.auth.getUser();
    if (uErr || !u?.user?.id) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }

    const userId = u.user.id;

    // OJO: NO hacemos join directo orders->events (no hay relación en schema cache)
    // Traemos event vía tickets->events
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
          section_label,
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
        )
      `
      )
      .eq("buyer_id", userId)
      .order("created_at", { ascending: false });

    if (qErr) {
      return NextResponse.json({ error: qErr.message }, { status: 500 });
    }

    // dedupe por ticket_id
    const unique = dedupeByTicketId(rows);

    // “Subimos” el event a nivel superior para que tu UI siga leyendo order.event
    const normalized = unique.map((o) => {
      const ev = o?.ticket?.event || null;
      const ticket = o?.ticket
        ? (() => {
            const { event, ...rest } = o.ticket; // sacamos event duplicado dentro del ticket
            return rest;
          })()
        : null;

      return { ...o, ticket, event: ev };
    });

    return NextResponse.json({ orders: normalized }, { status: 200 });
  } catch (e) {
    return NextResponse.json(
      { error: e?.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}



