import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

async function getUserFromRequest(req) {
  const auth = req.headers.get("authorization") || "";
  if (auth.startsWith("Bearer ")) {
    const token = auth.replace("Bearer ", "").trim();
    try {
      const admin = supabaseAdmin();
      const { data, error } = await admin.auth.getUser(token);
      if (!error && data?.user) return data.user;
    } catch {
      // fallthrough a cookies
    }
  }

  const cookieStore = cookies();
  const supabase = createClient(cookieStore);
  const { data } = await supabase.auth.getUser();
  return data?.user || null;
}

function normalizeRole(role) {
  const r = String(role || "").toLowerCase();
  if (r === "buyer" || r === "seller") return r;
  return null;
}

function normalizeStars(stars) {
  const n = Number(stars);
  if (!Number.isFinite(n)) return null;
  const rounded = Math.round(n);
  if (rounded < 1 || rounded > 5) return null;
  return rounded;
}

export async function GET(req) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const orderId = searchParams.get("orderId") || "";
    const role = normalizeRole(searchParams.get("role"));

    if (!orderId || !role) {
      return NextResponse.json(
        { error: "Parámetros inválidos" },
        { status: 400 }
      );
    }

    let admin;
    try {
      admin = supabaseAdmin();
    } catch {
      return NextResponse.json(
        { error: "Missing Supabase env vars" },
        { status: 500 }
      );
    }

    const { data: rating, error } = await admin
      .from("ratings")
      .select("id, order_id, rater_id, role, stars, comment, created_at, target_id")
      .eq("order_id", orderId)
      .eq("rater_id", user.id)
      .eq("role", role)
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { error: "No se pudo cargar la calificación" },
        { status: 500 }
      );
    }

    return NextResponse.json({ rating: rating || null });
  } catch (err) {
    console.error("GET /api/ratings error", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const orderId = body?.orderId;
    const role = normalizeRole(body?.role);
    const stars = normalizeStars(body?.stars);
    const comment = typeof body?.comment === "string" ? body.comment.trim() : null;

    if (!orderId || !role || !stars) {
      return NextResponse.json(
        { error: "Datos incompletos" },
        { status: 400 }
      );
    }

    let admin;
    try {
      admin = supabaseAdmin();
    } catch {
      return NextResponse.json(
        { error: "Missing Supabase env vars" },
        { status: 500 }
      );
    }

    const { data: order, error: orderErr } = await admin
      .from("orders")
      .select("id, buyer_id, user_id, seller_id, ticket_id, status")
      .eq("id", orderId)
      .maybeSingle();

    if (orderErr) {
      return NextResponse.json(
        { error: "Error buscando la orden" },
        { status: 500 }
      );
    }

    if (!order) {
      return NextResponse.json(
        { error: "Orden no encontrada" },
        { status: 404 }
      );
    }

    const buyerId = order.buyer_id || order.user_id;
    const sellerId = order.seller_id;

    if (role === "buyer" && user.id !== buyerId) {
      return NextResponse.json(
        { error: "No autorizado para calificar esta compra" },
        { status: 403 }
      );
    }

    if (role === "seller" && user.id !== sellerId) {
      return NextResponse.json(
        { error: "No autorizado para calificar esta venta" },
        { status: 403 }
      );
    }

    let ticketStatus = null;
    if (order.ticket_id) {
      const { data: ticket } = await admin
        .from("tickets")
        .select("status")
        .eq("id", order.ticket_id)
        .maybeSingle();
      ticketStatus = ticket?.status || null;
    }

    if (String(ticketStatus || "").toLowerCase() !== "sold") {
      return NextResponse.json(
        { error: "Solo puedes calificar cuando la entrada está vendida" },
        { status: 400 }
      );
    }

    const existing = await admin
      .from("ratings")
      .select("id, order_id, rater_id, role, stars, comment, created_at, target_id")
      .eq("order_id", orderId)
      .eq("rater_id", user.id)
      .eq("role", role)
      .maybeSingle();

    if (existing?.data) {
      return NextResponse.json({ rating: existing.data, alreadyRated: true });
    }

    const targetId = role === "buyer" ? sellerId : buyerId;
    if (!targetId) {
      return NextResponse.json(
        { error: "No se pudo identificar el usuario a calificar" },
        { status: 400 }
      );
    }

    const { data: rating, error: insErr } = await admin
      .from("ratings")
      .insert({
        order_id: orderId,
        rater_id: user.id,
        target_id: targetId,
        role,
        stars,
        comment: comment || null,
      })
      .select("id, order_id, rater_id, role, stars, comment, created_at, target_id")
      .maybeSingle();

    if (insErr) {
      return NextResponse.json(
        { error: "No se pudo guardar la calificación" },
        { status: 500 }
      );
    }

    return NextResponse.json({ rating });
  } catch (err) {
    console.error("POST /api/ratings error", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
