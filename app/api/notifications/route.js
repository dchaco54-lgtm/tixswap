import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

async function getAuthContext(req) {
  const authHeader = req.headers.get("authorization") || "";
  if (authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    try {
      const admin = supabaseAdmin();
      const { data, error } = await admin.auth.getUser(token);
      if (!error && data?.user) {
        return { user: data.user, db: admin };
      }
    } catch {
      // fallback a cookies
    }
  }

  const supabase = createRouteHandlerClient({ cookies });
  const { data } = await supabase.auth.getUser();
  return { user: data?.user || null, db: supabase };
}

export async function GET(req) {
  try {
    const { user, db } = await getAuthContext(req);
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const url = new URL(req.url);
    const limitParam = Number(url.searchParams.get("limit") || 8);
    const offsetParam = Number(url.searchParams.get("offset") || 0);
    const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 50) : 8;
    const offset = Number.isFinite(offsetParam) ? Math.max(offsetParam, 0) : 0;

    const { data, error } = await db
      .from("notifications")
      .select("id, type, title, body, link, is_read, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      return NextResponse.json({ error: "No se pudieron cargar" }, { status: 500 });
    }

    return NextResponse.json({ notifications: data || [] }, { status: 200 });
  } catch (err) {
    console.error("GET /api/notifications error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
