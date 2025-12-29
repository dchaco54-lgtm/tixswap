import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET() {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes?.user;

  if (!user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const admin = supabaseAdmin();

  try {
    const { data: orders, error: oErr } = await admin
      .from("orders")
      .select("id, status, created_at, amount_clp, total_paid_clp, ticket_id, event_id, payment_request_id")
      .eq("buyer_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (oErr) {
      return NextResponse.json({ error: "No se pudieron cargar órdenes." }, { status: 500 });
    }

    const ticketIds = Array.from(new Set((orders || []).map((o) => o.ticket_id).filter(Boolean)));
    const eventIds = Array.from(new Set((orders || []).map((o) => o.event_id).filter(Boolean)));

    const [{ data: tickets }, { data: events }] = await Promise.all([
      ticketIds.length
        ? admin
            .from("tickets")
            .select("id, sector, row, seat, price")
            .in("id", ticketIds)
        : Promise.resolve({ data: [] }),
      eventIds.length
        ? admin
            .from("events")
            .select("id, title, starts_at, venue, city")
            .in("id", eventIds)
        : Promise.resolve({ data: [] }),
    ]);

    const tMap = new Map((tickets || []).map((t) => [t.id, t]));
    const eMap = new Map((events || []).map((e) => [e.id, e]));

    const items = (orders || []).map((o) => ({
      ...o,
      ticket: o.ticket_id ? tMap.get(o.ticket_id) || null : null,
      event: o.event_id ? eMap.get(o.event_id) || null : null,
    }));

    return NextResponse.json({ ok: true, items });
  } catch (e) {
    console.error("orders/my error:", e);
    return NextResponse.json({ error: "Error interno." }, { status: 500 });
  }
}
