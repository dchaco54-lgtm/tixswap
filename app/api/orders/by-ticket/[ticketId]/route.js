// app/api/orders/by-ticket/[ticketId]/route.js
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { supabaseServiceOptional } from "@/lib/supabaseServiceOptional";

export const dynamic = "force-dynamic";

function envError() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: "Missing Supabase env vars" }, { status: 500 });
  }
  return null;
}

export async function GET(request, { params }) {
  try {
    const e = envError();
    if (e) return e;

    const ticketId = params?.ticketId;
    if (!ticketId) {
      return NextResponse.json({ error: "Falta ticketId" }, { status: 400 });
    }

    const supabaseAuth = createClient(cookies());
    const service = supabaseServiceOptional();

    // Auth obligatorio (Bearer preferido, cookies fallback)
    const authHeader = request.headers.get("authorization");
    let user = null;

    if (authHeader?.startsWith("Bearer ") && service) {
      const token = authHeader.slice(7);
      const { data: authData, error: authErr } = await service.auth.getUser(token);
      if (authErr || !authData?.user) {
        return NextResponse.json({ error: "No autorizado" }, { status: 401 });
      }
      user = authData.user;
    } else {
      const {
        data: { user: cookieUser },
        error: authErr,
      } = await supabaseAuth.auth.getUser();
      if (authErr || !cookieUser) {
        return NextResponse.json({ error: "No autorizado" }, { status: 401 });
      }
      user = cookieUser;
    }

    const db = service || supabaseAuth;

    // Verificar ownership del ticket
    const { data: ticket, error: tErr } = await db
      .from("tickets")
      .select("id,seller_id")
      .eq("id", ticketId)
      .maybeSingle();

    if (tErr) {
      return NextResponse.json({ error: "DB error", details: tErr.message }, { status: 500 });
    }
    if (!ticket) {
      return NextResponse.json({ error: "Ticket no encontrado" }, { status: 404 });
    }
    if (ticket.seller_id !== user.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const { data: order, error: oErr } = await db
      .from("orders")
      .select(
        "id,status,created_at,total_amount,total_clp,amount,amount_clp,fee_clp,fees_clp,currency,buyer_id,seller_id,renominated_storage_bucket,renominated_storage_path"
      )
      .eq("ticket_id", ticketId)
      .maybeSingle();

    if (oErr) {
      return NextResponse.json({ error: "DB error", details: oErr.message }, { status: 500 });
    }

    if (!order) {
      return NextResponse.json({ order: null }, { status: 200 });
    }

    if (order.seller_id && order.seller_id !== user.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    let buyer = null;
    if (order.buyer_id) {
      const { data: prof, error: pErr } = await db
        .from("profiles")
        .select("full_name,email,rut")
        .eq("id", order.buyer_id)
        .maybeSingle();
      if (!pErr) buyer = prof;
    }

    return NextResponse.json(
      {
        order: {
          id: order.id,
          status: order.status || null,
          created_at: order.created_at || null,
          total_amount: order.total_amount ?? null,
          platform_fee: order.fee_clp ?? order.fees_clp ?? null,
          ticket_price: order.amount_clp ?? order.amount ?? null,
          buyer_name: buyer?.full_name ?? null,
          buyer_email: buyer?.email ?? null,
          buyer_rut: buyer?.rut ?? null,
          chat_id: order.id,
          renominated_storage_path: order.renominated_storage_path ?? null,
          renominated_storage_bucket: order.renominated_storage_bucket ?? null,
        },
      },
      { status: 200 }
    );
  } catch (err) {
    return NextResponse.json(
      { error: "Error interno", details: err?.message || String(err) },
      { status: 500 }
    );
  }
}

