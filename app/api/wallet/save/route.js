// app/api/wallet/save/route.js
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

export async function POST(req) {
  try {
    const supabase = getSupabaseAdmin();

    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

    const { data: uData, error: uErr } = await supabase.auth.getUser(token);
    if (uErr || !uData?.user) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }
    const user = uData.user;

    const body = await req.json().catch(() => ({}));
    const bank_name = (body?.bank_name || "").trim();
    const account_type = (body?.account_type || "").trim();
    const account_number = (body?.account_number || "").trim();
    const transfer_email = (body?.transfer_email || "").trim() || null;
    const transfer_phone = (body?.transfer_phone || "").trim() || null;

    if (!bank_name || !account_type || !account_number) {
      return NextResponse.json(
        { error: "Faltan datos obligatorios (banco, tipo, número de cuenta)." },
        { status: 400 }
      );
    }

    // 🔒 Anti-estafa: nombre + rut SIEMPRE desde la cuenta (metadata)
    const holder_name =
      user.user_metadata?.name ||
      user.user_metadata?.full_name ||
      user.user_metadata?.fullName ||
      "";
    const holder_rut = (user.user_metadata?.rut || "").trim();

    if (!holder_name || !holder_rut) {
      return NextResponse.json(
        { error: "Tu cuenta no tiene Nombre/RUT. Completa tu RUT en el perfil antes de configurar Wallet." },
        { status: 400 }
      );
    }

    const payload = {
      user_id: user.id,
      holder_name,
      holder_rut,
      bank_name,
      account_type,
      account_number,
      transfer_email,
      transfer_phone,
    };

    const { data, error } = await supabase
      .from("payout_accounts")
      .upsert(payload, { onConflict: "user_id" })
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: "DB error", details: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, payout_account: data });
  } catch (e) {
    return NextResponse.json(
      { error: "Server error", details: e?.message || String(e) },
      { status: 500 }
    );
  }
}
