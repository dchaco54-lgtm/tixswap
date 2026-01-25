// app/api/tickets/my-publications/route.js
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function noStoreJson(payload, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      Pragma: "no-cache",
    },
  });
}

async function getUserFromCookiesOrBearer(req) {
  // 1) Cookie session (normal en tu app)
  const supabase = createClient(cookies());
  const { data: userData } = await supabase.auth.getUser();
  if (userData?.user) return userData.user;

  // 2) Bearer token (por si llamas desde client con Authorization)
  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return null;

  const admin = supabaseAdmin();
  const { data, error } = await admin.auth.getUser(token);
  if (error) return null;
  return data?.user ?? null;
}

function normStatus(s) {
  return String(s || "").toLowerCase() || "active";
}

function normPrice(ticket) {
  // Prioriza el precio de venta. Si no existe, cae al original.
  const p =
    ticket?.price ??
    ticket?.price_clp ??
    ticket?.sale_price ??
    ticket?.list_price ??
    ticket?.original_price ??
    ticket?.face_value ??
    0;

  const n = Number(p);
  return Number.isFinite(n) ? n : 0;
}

function normOriginalPrice(ticket) {
  const p = ticket?.original_price ?? ticket?.face_value ?? null;
  const n = p == null ? null : Number(p);
  return n == null || !Number.isFinite(n) ? null : n;
}

export async function GET(req) {
  try {
    const user = await getUserFromCookiesOrBearer(req);
    if (!user) return noStoreJson({ error: "No autorizado" }, 401);

    const admin = supabaseAdmin();

    // Trae SIEMPRE desde DB real (service role), pero filtrado por seller_id = user.id
    const select = `
      id,
      event_id,
      seller_id,
      status,
      price,
      original_price,
      created_at,
      updated_at,
      sector,
      row_label,
      seat_label,
      notes,
      sale_type,
      held_until,
      event:events (
        id,
        title,
        starts_at,
        venue,
        city,
        cover_url
      )
    `;

    let { data: tickets, error } = await admin
      .from("tickets")
      .select(select)
      .eq("seller_id", user.id)
      .order("created_at", { ascending: false });

    // Si falla el embed (por relación), fallback sin event
    if (error) {
      const fallback = await admin
        .from("tickets")
        .select(
          "id,event_id,seller_id,status,price,original_price,created_at,updated_at,sector,row_label,seat_label,notes,sale_type,held_until"
        )
        .eq("seller_id", user.id)
        .order("created_at", { ascending: false });

      if (fallback.error) {
        return noStoreJson({ error: fallback.error.message }, 500);
      }
      tickets = fallback.data || [];
    }

    const normalized = (tickets || []).map((t) => ({
      ...t,
      status: normStatus(t.status),
      price: normPrice(t),
      original_price: normOriginalPrice(t),
    }));

    const summary = normalized.reduce(
      (acc, t) => {
        acc.total += 1;
        const st = t.status;
        if (st === "active") acc.active += 1;
        else if (st === "paused") acc.paused += 1;
        else if (st === "sold") acc.sold += 1;
        else if (st === "held") acc.held += 1;
        else acc.other += 1;
        return acc;
      },
      { total: 0, active: 0, paused: 0, sold: 0, held: 0, other: 0 }
    );

    return noStoreJson({ tickets: normalized, summary });
  } catch (e) {
    return noStoreJson({ error: e.message || "Error interno" }, 500);
  }
}

