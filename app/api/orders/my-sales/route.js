// app/api/orders/my-sales/route.js
export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { ROLE_DEFS, ROLE_ORDER, normalizeRole } from "@/lib/roles";

export const runtime = "nodejs";

function roleRank(roleKey) {
  const i = ROLE_ORDER.indexOf(roleKey);
  return i === -1 ? 0 : i;
}

function computeRoleFromSales(soldCount) {
  let best = "basic";
  for (const key of ROLE_ORDER) {
    const need = ROLE_DEFS[key]?.opsRequired ?? 0;
    if (soldCount >= need) best = key;
  }
  return best;
}
function getBearerToken(req) {
  const h = req.headers.get("authorization") || "";
  const [type, token] = h.split(" ");
  if ((type || "").toLowerCase() !== "bearer") return null;
  return token || null;
}

function isPaid(order) {
  const s = String(order?.status || "").toLowerCase();
  const ps = String(order?.payment_state || "").toLowerCase();
  return s === "paid" || ps === "paid";
}
function normalizeBuyerId(order) {
  return order?.buyer_id || order?.user_id || null;
}

function monthKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function monthLabel(d) {
  const MONTHS = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
  return MONTHS[d.getMonth()];
}

function buildLastMonths(count) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const out = [];

  for (let i = count - 1; i >= 0; i -= 1) {
    const d = new Date(start.getFullYear(), start.getMonth() - i, 1);
    out.push({
      year: d.getFullYear(),
      month: d.getMonth(),
    });
  }
  return out;
}

export async function GET(req) {
  try {
    const admin = supabaseAdmin();
    const token = getBearerToken(req);

    if (!token) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { data: userRes, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userRes?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const userId = userRes.user.id;

    // Perfil actual (para upgrade automático)
    const { data: prof, error: profErr } = await admin
      .from("profiles")
      .select("user_type")
      .maybeSingle();

    if (profErr) throw profErr;

    const roleRaw = String(prof?.user_type || "").trim().toLowerCase();
    const isPrivileged = roleRaw === "admin" || roleRaw === "seller";
    const currentRoleKey = isPrivileged ? roleRaw : normalizeRole(roleRaw);

    const url = new URL(req.url);
    const months = Math.min(Math.max(parseInt(url.searchParams.get("months") || "6", 10), 1), 24);
    const listMonths = Math.min(Math.max(parseInt(url.searchParams.get("listMonths") || "3", 10), 1), 12);

    // 1) Tickets del seller
    const { data: tickets, error: tErr } = await admin
      .from("tickets")
      .select("id,status")
      .eq("seller_id", userId);

    if (tErr) throw tErr;

    const ticketIds = (tickets || []).map((t) => t.id).filter(Boolean);
    const soldCount = (tickets || []).filter((t) => String(t.status || "").toLowerCase() === "sold").length;

    // 🔥 CATEGORÍA AUTOMÁTICA
    const computedTier = computeRoleFromSales(soldCount);
    let upgraded = false;
    let effectiveTierKey = currentRoleKey || "basic";
    // Solo sube nivel (no baja) y no pisa admin/seller
    if (!isPrivileged && roleRank(computedTier) > roleRank(currentRoleKey || "basic")) {
      const { error: upErr } = await admin
        .from("profiles")
        .update({ seller_tier: computedTier })
        .eq("id", userId);
      if (!upErr) {
        upgraded = true;
        effectiveTierKey = computedTier;
      }
    }

    const lastMonths = buildLastMonths(months);
    const monthly = lastMonths.map((m) => ({ key: m.key, label: m.label, count: 0, total_clp: 0 }));

    if (ticketIds.length === 0) {
      return NextResponse.json({
        soldCount,
        paid90dCount: 0,
        paid90dTotal: 0,
        monthly,
        recentSales: [],
        computedRole: isPrivileged ? (roleRaw || "basic") : effectiveRoleKey,
        upgraded,
      });
    }

    const firstMonth = new Date(lastMonths[0].year, lastMonths[0].month, 1);
    const startISO = firstMonth.toISOString();

    const listStartMonth = buildLastMonths(listMonths)[0];
    const listStartISO = new Date(listStartMonth.year, listStartMonth.month, 1).toISOString();

    // 2) Orders de esos tickets (schema-safe)
    const { data: orders, error: oErr } = await admin
      .from("orders")
      .select(`id,status,payment_state,created_at,paid_at,total_amount,total_paid_clp,amount_clp,buyer_id,user_id,ticket_id,
        ticket:ticket_id(id,price,sector,row_label,seat_label,notes,status,
          event:events(id,title,starts_at,venue,city)
        )
      `)
      .in("ticket_id", ticketIds)
      .gte("created_at", startISO)
      .order("created_at", { ascending: false })
      .limit(2000);

    if (oErr) throw oErr;

    const paidOrders = (orders || []).filter(isPaid);

    // buyer profiles
    const buyerIds = Array.from(new Set(paidOrders.map(normalizeBuyerId).filter(Boolean)));
    let buyerMap = {};

    if (buyerIds.length) {
      const { data: buyers, error: bErr } = await admin
        .from("profiles")
        .select("id,full_name,name,email")
        .in("id", buyerIds);

      if (bErr) throw bErr;

      buyerMap = Object.fromEntries((buyers || []).map((b) => [b.id, b]));
    }

    // monthly aggregation
    const agg = {};
    for (const o of paidOrders) {
      const dt = o.paid_at ? new Date(o.paid_at) : new Date(o.created_at);
      const k = monthKey(dt);
      if (!agg[k]) agg[k] = { count: 0, total: 0 };
      agg[k].count += 1;
      agg[k].total += Number(o.total_paid_clp ?? o.total_amount ?? o.amount_clp ?? 0) || 0;
    }

    const monthlyOut = lastMonths.map((m) => {
      const a = agg[m.key] || { count: 0, total: 0 };
      return { key: m.key, label: m.label, count: a.count, total_clp: Math.round(a.total) };
    });

    // 90d
    const start90 = new Date();
    start90.setDate(start90.getDate() - 90);

    const paid90 = paidOrders.filter((o) => new Date(o.paid_at || o.created_at) >= start90);
    const paid90dCount = paid90.length;
    const paid90dTotal = paid90.reduce((sum, o) => sum + (Number(o.total_paid_clp ?? o.total_amount ?? o.amount_clp ?? 0) || 0), 0);

    // recent list
    const recentSales = paidOrders
      .filter((o) => new Date(o.paid_at || o.created_at) >= new Date(listStartISO))
      .slice(0, 200)
      .map((o) => {
        const buyerId = normalizeBuyerId(o);
        const buyer = buyerId ? buyerMap[buyerId] : null;

        const total = Number(o.total_paid_clp ?? o.total_amount ?? o.amount_clp ?? 0) || 0;

        return {
          id: o.id,
          status: o.status,
          payment_state: o.payment_state,
          created_at: o.created_at,
          paid_at: o.paid_at,
          total_paid_clp: total,
          total_clp: total,
          buyer: buyer
            ? { id: buyer.id, full_name: buyer.full_name || buyer.name || buyer.email || "Comprador", email: buyer.email || null }
            : null,
          ticket: o.ticket
            ? {
                id: o.ticket.id,
                sector: o.ticket.sector,
                row: o.ticket.row,
                seat: o.ticket.seat,
                notes: o.ticket.notes,
                event: o.ticket?.event
                  ? {
                      id: o.ticket.event.id,
                      title: o.ticket.event.title,
                      starts_at: o.ticket.event.starts_at,
                      venue: o.ticket.event.venue,
                      city: o.ticket.event.city,
                    }
                  : null,
              }
            : null,
        };
      });

    return NextResponse.json({
      soldCount,
      paid90dCount,
      paid90dTotal: Math.round(paid90dTotal),
      monthly: monthlyOut,
      recentSales,
      computedRole: isPrivileged ? (roleRaw || "basic") : effectiveRoleKey,
      upgraded,
    });
  } catch (err) {
    console.error("my-sales error", err);
    return NextResponse.json({ error: err?.message || "Error" }, { status: 500 });
  }
}
