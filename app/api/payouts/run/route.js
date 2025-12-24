import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) throw new Error("Missing env: NEXT_PUBLIC_SUPABASE_URL");
  if (!serviceKey) throw new Error("Missing env: SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

async function isAdminByProfiles(supabase, userId) {
  const { data, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  if (error) return false;
  return data?.role === "admin";
}

export async function POST(req) {
  try {
    const supabase = getSupabaseAdmin();

    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

    const { data: uData, error: uErr } = await supabase.auth.getUser(token);
    if (uErr || !uData?.user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    const user = uData.user;

    const admin = await isAdminByProfiles(supabase, user.id);
    if (!admin) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

    const now = new Date();

    // 1) Traer órdenes aún retenidas o buyer_ok, sin batch, no disputadas
    const { data: orders, error: oErr } = await supabase
      .from("orders")
      .select("id, seller_id, amount_clp, status, release_at, event_starts_at")
      .in("status", ["held", "buyer_ok", "ready_to_payout"])
      .is("payout_batch_id", null);

    if (oErr) return NextResponse.json({ error: "DB error", details: oErr.message }, { status: 500 });

    const updates = [];
    for (const o of orders || []) {
      if (o.status === "disputed") continue;

      // si no tiene release_at: event + 48h
      let releaseAt = o.release_at ? new Date(o.release_at) : null;
      if (!releaseAt) {
        const base = o.event_starts_at ? new Date(o.event_starts_at) : null;
        if (base && !Number.isNaN(base.getTime())) {
          releaseAt = new Date(base.getTime() + 48 * 60 * 60 * 1000);
          updates.push({ id: o.id, status: o.status, release_at: releaseAt.toISOString() });
        }
      }

      // si ya pasó releaseAt => ready_to_payout
      if (releaseAt && now >= releaseAt && o.status !== "ready_to_payout") {
        updates.push({ id: o.id, status: "ready_to_payout", release_at: releaseAt.toISOString() });
      }
    }

    // aplicar updates (si hay)
    for (const u of updates) {
      await supabase.from("orders").update(u).eq("id", u.id);
    }

    // 2) Traer listos para pagar
    const { data: ready, error: rErr } = await supabase
      .from("orders")
      .select("id, seller_id, amount_clp")
      .eq("status", "ready_to_payout")
      .is("payout_batch_id", null);

    if (rErr) return NextResponse.json({ error: "DB error", details: rErr.message }, { status: 500 });

    if (!ready || ready.length === 0) {
      return NextResponse.json({ ok: true, message: "No hay pagos listos para este ciclo.", batch_id: null, transfers: [] });
    }

    // 3) Crear batch
    const total = ready.reduce((acc, x) => acc + Number(x.amount_clp || 0), 0);

    const { data: batch, error: bErr } = await supabase
      .from("payout_batches")
      .insert([{ run_by: user.id, status: "prepared", total_amount_clp: total }])
      .select("id, run_at, total_amount_clp")
      .single();

    if (bErr) return NextResponse.json({ error: "DB error", details: bErr.message }, { status: 500 });

    // 4) Adjuntar batch a órdenes
    const orderIds = ready.map((x) => x.id);
    const { error: aErr } = await supabase
      .from("orders")
      .update({ payout_batch_id: batch.id })
      .in("id", orderIds);

    if (aErr) return NextResponse.json({ error: "DB error", details: aErr.message }, { status: 500 });

    // 5) Traer datos bancarios (payout_accounts)
    const sellerIds = [...new Set(ready.map((x) => x.seller_id))];

    const { data: accounts } = await supabase
      .from("payout_accounts")
      .select("user_id, holder_name, holder_rut, bank_name, account_type, account_number, transfer_email, transfer_phone")
      .in("user_id", sellerIds);

    const mapAcc = new Map((accounts || []).map((a) => [a.user_id, a]));

    // 6) Agrupar por seller (puede haber varias órdenes)
    const totalsBySeller = new Map();
    for (const row of ready) {
      const prev = totalsBySeller.get(row.seller_id) || 0;
      totalsBySeller.set(row.seller_id, prev + Number(row.amount_clp || 0));
    }

    const transfers = Array.from(totalsBySeller.entries()).map(([seller_id, amount_clp]) => {
      const acc = mapAcc.get(seller_id) || null;
      return {
        seller_id,
        amount_clp,
        payout_account: acc,
      };
    });

    return NextResponse.json({
      ok: true,
      batch_id: batch.id,
      run_at: batch.run_at,
      total_amount_clp: batch.total_amount_clp,
      transfers,
      note: "Este endpoint prepara el lote. Luego haces transferencias manuales y (cuando quieras) marcamos como pagado en otro endpoint.",
    });
  } catch (e) {
    return NextResponse.json({ error: "Server error", details: e?.message || String(e) }, { status: 500 });
  }
}
