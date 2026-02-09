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

export async function POST(req) {
  try {
    const { user, db } = await getAuthContext(req);
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { error } = await db
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", user.id)
      .eq("is_read", false);

    if (error) {
      return NextResponse.json({ error: "No se pudo actualizar" }, { status: 500 });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("POST /api/notifications/mark-all-read error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
