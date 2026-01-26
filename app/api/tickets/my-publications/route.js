import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Fuerza a Next a no intentar cachear esta ruta como estática
export const dynamic = "force-dynamic";
// También puedes dejar esto si quieres: export const revalidate = 0;

export async function GET(req) {
  try {
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ")
      ? authHeader.slice(7)
      : null;

    if (!token) {
      return NextResponse.json(
        { error: "Missing token" },
        {
          status: 401,
          headers: {
            "Cache-Control":
              "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
            Pragma: "no-cache",
            Expires: "0",
          },
        }
      );
    }

    const admin = supabaseAdmin();

    // Obtener usuario desde el JWT (con admin client)
    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData?.user?.id) {
      return NextResponse.json(
        { error: "Invalid token" },
        {
          status: 401,
          headers: {
            "Cache-Control":
              "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
            Pragma: "no-cache",
            Expires: "0",
          },
        }
      );
    }

    const userId = userData.user.id;

    // Traer publicaciones del vendedor + evento asociado
    const { data: tickets, error } = await admin
      .from("tickets")
      .select(
        `
        id,
        price,
        currency,
        sector,
        row_label,
        seat_label,
        status,
        created_at,
        file_url,
        is_named,
        event:events (
          id,
          city,
          title,
          venue,
          starts_at
        )
      `
      )
      .eq("seller_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: error.message },
        {
          status: 500,
          headers: {
            "Cache-Control":
              "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
            Pragma: "no-cache",
            Expires: "0",
          },
        }
      );
    }

    const normTickets = (tickets || []).map((t) => ({
      id: t.id,
      price: t.price,
      currency: t.currency,
      section: t.sector,
      row: t.row_label,
      seat: t.seat_label,
      status: t.status,
      created_at: t.created_at,
      file_url: t.file_url,
      is_named: Boolean(t.is_named),
      event: t.event
        ? {
            id: t.event.id,
            city: t.event.city,
            title: t.event.title,
            venue: t.event.venue,
            starts_at: t.event.starts_at,
          }
        : null,
    }));

    const summary = {
      total: normTickets.length,
      active: normTickets.filter((t) => t.status === "active").length,
      paused: normTickets.filter((t) => t.status === "paused").length,
      sold: normTickets.filter((t) => t.status === "sold").length,
    };

    return NextResponse.json(
      { tickets: normTickets, summary },
      {
        status: 200,
        headers: {
          "Cache-Control":
            "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
          Pragma: "no-cache",
          Expires: "0",
        },
      }
    );
  } catch (e) {
    return NextResponse.json(
      { error: e?.message || "Unknown error" },
      {
        status: 500,
        headers: {
          "Cache-Control":
            "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
          Pragma: "no-cache",
          Expires: "0",
        },
      }
    );
  }
}

