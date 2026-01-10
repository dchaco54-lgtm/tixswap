// app/api/orders/my/route.js
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(request) {
  try {
    const authHeader = request.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.replace("Bearer ", "")
      : null;

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        global: {
          headers: { Authorization: `Bearer ${token}` },
        },
      }
    );

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: orders, error } = await supabase
      .from("orders")
      .select(
        `
        id,
        total_amount,
        status,
        created_at,
        provider,
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
      .eq("buyer_id", user.id)
      .order("created_at", { ascending: false });

    // Si la tabla no existe aún (o algo cambió), no rompas la UI:
    if (error) {
      const code = error.code || error?.details?.code;
      if (code === "42P01") {
        return NextResponse.json({ orders: [], notReady: true }, { status: 200 });
      }
      return NextResponse.json({ orders: [], warning: error.message }, { status: 200 });
    }

    return NextResponse.json({ orders: orders || [] });
  } catch (e) {
    // Nunca rompas la UI por un error inesperado
    return NextResponse.json({ orders: [], warning: "Unexpected error" }, { status: 200 });
  }
}
