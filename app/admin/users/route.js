// app/api/admin/users/route.js
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

async function requireAdmin(supabase, token) {
  const { data: uData, error: uErr } = await supabase.auth.getUser(token);
  if (uErr || !uData?.user) return { ok: false, status: 401, error: "UNAUTHORIZED" };

  const me = uData.user;

  const { data: profile, error: pErr } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", me.id)
    .maybeSingle();

  if (pErr) return { ok: false, status: 500, error: pErr.message };
  if (!profile || profile.role !== "admin") return { ok: false, status: 403, error: "FORBIDDEN" };

  return { ok: true, me };
}

function pickMeta(u, key) {
  return (u?.user_metadata && u.user_metadata[key]) || (u?.raw_user_meta_data && u.raw_user_meta_data[key]) || null;
}

export async function GET(req) {
  try {
    const supabase = getSupabaseAdmin();

    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

    const guard = await requireAdmin(supabase, token);
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

    // lista users Auth
    const { data: listData, error: listErr } = await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });
    if (listErr) return NextResponse.json({ error: listErr.message }, { status: 500 });

    const authUsers = listData?.users || [];
    const ids = authUsers.map((u) => u.id);

    // perfiles existentes
    let profiles = [];
    if (ids.length) {
      const { data: pData, error: pErr } = await supabase
        .from("profiles")
        .select("id,email,full_name,rut,phone,role,is_blocked")
        .in("id", ids);

      if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });
      profiles = pData || [];
    }

    const byId = new Map(profiles.map((p) => [p.id, p]));

    // crear perfiles faltantes (para los que existen en Auth pero no en profiles)
    const missing = authUsers
      .filter((u) => !byId.has(u.id))
      .map((u) => ({
        id: u.id,
        email: u.email || null,
        full_name: pickMeta(u, "full_name") || pickMeta(u, "name") || null,
        rut: pickMeta(u, "rut") || null,
        phone: pickMeta(u, "phone") || null,
        role: "user",
        is_blocked: false,
      }));

    if (missing.length) {
      const { error: insErr } = await supabase.from("profiles").insert(missing);
      if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

      // re-fetch
      const { data: p2, error: p2Err } = await supabase
        .from("profiles")
        .select("id,email,full_name,rut,phone,role,is_blocked")
        .in("id", ids);

      if (p2Err) return NextResponse.json({ error: p2Err.message }, { status: 500 });
      profiles = p2 || [];
    }

    const byId2 = new Map(profiles.map((p) => [p.id, p]));

    const merged = authUsers.map((u) => {
      const p = byId2.get(u.id) || {};
      return {
        id: u.id,
        email: p.email || u.email || null,
        full_name: p.full_name || null,
        rut: p.rut || null,
        phone: p.phone || null,
        role: p.role || "user",
        is_blocked: !!p.is_blocked,
        created_at: u.created_at || null,
        last_sign_in_at: u.last_sign_in_at || null,
        email_confirmed_at: u.email_confirmed_at || null,
      };
    });

    // orden por email pa que se vea ordenadito
    merged.sort((a, b) => (a.email || "").localeCompare(b.email || ""));

    return NextResponse.json({ ok: true, users: merged });
  } catch (e) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 });
  }
}
