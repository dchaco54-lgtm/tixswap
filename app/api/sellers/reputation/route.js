import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function isUuid(v) {
  return (
    typeof v === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      v
    )
  );
}

function round1(n) {
  return Math.round(n * 10) / 10;
}

/**
 * Reputación MVP (sin tabla de ratings aún):
 * - < 5 ventas => "Vendedor nuevo"
 * - >= 5 ventas => score 1..5 basado en % de disputas (si hay disputas, baja).
 *   score = 5 - 4*(disputes/total_orders)
 */
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const sellerId = searchParams.get("sellerId")?.trim();

  if (!sellerId || !isUuid(sellerId)) {
    return NextResponse.json({ error: "sellerId inválido" }, { status: 400 });
  }

  const admin = supabaseAdmin();

  try {
    // 1) Tickets del seller (para contar ventas y poder mapear a orders)
    const { data: tickets, error: tErr } = await admin
      .from("tickets")
      .select("id,status")
      .eq("seller_id", sellerId)
      .limit(1000);

    if (tErr) {
      // Fallback ultra seguro
      return NextResponse.json({ label: "Vendedor nuevo" }, { status: 200 });
    }

    const ticketIds = (tickets ?? []).map((t) => t.id).filter(Boolean);
    const soldCount = (tickets ?? []).filter((t) => t.status === "sold").length;

    // Si no llega al mínimo, mostramos "Vendedor nuevo".
    if (soldCount < 5) {
      return NextResponse.json(
        { label: "Vendedor nuevo", sales_count: soldCount },
        { status: 200 }
      );
    }

    // 2) Orders asociadas a esos tickets (para detectar disputas)
    //    Ojo: si aún no hay orders, score queda 5.
    let totalOrders = 0;
    let disputeOrders = 0;

    if (ticketIds.length > 0) {
      const { data: orders, error: oErr } = await admin
        .from("orders")
        .select("status")
        .in("ticket_id", ticketIds)
        .limit(2000);

      if (!oErr && Array.isArray(orders)) {
        totalOrders = orders.length;
        disputeOrders = orders.filter((o) => o.status === "dispute").length;
      }
    }

    const disputeRate = totalOrders > 0 ? disputeOrders / totalOrders : 0;
    const score = round1(Math.max(1, Math.min(5, 5 - 4 * disputeRate)));

    return NextResponse.json(
      {
        label: `${score}/5`,
        score,
        sales_count: soldCount,
        orders_count: totalOrders,
        disputes_count: disputeOrders,
      },
      { status: 200 }
    );
  } catch {
    return NextResponse.json({ label: "Vendedor nuevo" }, { status: 200 });
  }
}
