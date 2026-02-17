import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const RECENT_DAYS = 14;

export async function GET(_req, { params }) {
  try {
    const eventId = params?.id;
    if (!eventId) {
      return NextResponse.json({ error: "Evento inválido" }, { status: 400 });
    }

    const admin = supabaseAdmin();

    const { data, error } = await admin
      .from("event_change_logs")
      .select(
        "id, event_id, change_type, change_type_detail, message_to_users, old_values, new_values, changed_fields, created_at"
      )
      .eq("event_id", eventId)
      .order("created_at", { ascending: false })
      .limit(5);

    if (error) {
      console.error("[events/changes] error:", error);
      return NextResponse.json({ error: "No pudimos cargar cambios" }, { status: 500 });
    }

    const logs = Array.isArray(data) ? data : [];
    const latest = logs[0] || null;
    let hasRecent = false;

    if (latest?.created_at) {
      const last = new Date(latest.created_at).getTime();
      if (Number.isFinite(last)) {
        const windowMs = RECENT_DAYS * 24 * 60 * 60 * 1000;
        hasRecent = Date.now() - last <= windowMs;
      }
    }

    return NextResponse.json({ logs, hasRecent });
  } catch (err) {
    console.error("[events/changes] exception:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
