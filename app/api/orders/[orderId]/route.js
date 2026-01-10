// app/api/orders/[orderId]/route.js
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(request, { params }) {
  try {
    const { orderId } = params || {};

    const authHeader = request.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.replace("Bearer ", "")
      : null;

    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!orderId) return NextResponse.json({ error: "Missing orderId" }, { status: 400 });

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        global: { headers: { Authorization: `Bearer ${token}` } },
      }
    );

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Intento 1: con joins
    const { data: order, error } = await supabase
      .from("orders")
      .select(
        `
        id,
        buyer_id,
        seller_id,
        ticket_id,
        total_amount,
        status,
        provider,
        created_at,
        ticket: tickets (
          id,
          price,
          section,
          row,
          seat,
          event: events ( id, name, venue, city ),
          seller: profiles!tickets_seller_id_fkey ( id, username, reputation )
        )
      `
      )
      .eq("id", orderId)
      .single();

    if (error) {
      const code = error.code || error?.details?.code;
      if (code === "42P01") {
        return NextResponse.json({ order: null, notReady: true }, { status: 200 });
      }
      return NextResponse.json({ order: null, warning: error.message }, { status: 200 });
    }

    // Seguridad básica: que sea del comprador
    if (order?.buyer_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({ order });
  } catch (e) {
    return NextResponse.json({ order: null, warning: "Unexpected error" }, { status: 200 });
  }
}
