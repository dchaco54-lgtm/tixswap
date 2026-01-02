import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

function isAvailableStatus(status) {
  const s = (status ?? "").toString().toLowerCase().trim();
  if (!s) return true; // si no hay columna status, no filtramos
  return ["active", "published", "available", "for_sale"].includes(s);
}

export async function GET(_req, { params }) {
  try {
    const eventId = params?.id;
    if (!eventId) {
      return NextResponse.json({ error: "Missing event id" }, { status: 400 });
    }

    const admin = supabaseAdmin();

    // select("*") para no romper si el schema cambió
    const { data, error } = await admin
      .from("tickets")
      .select("*")
      .eq("event_id", eventId);

    if (error) {
      console.error(`[api/events/${eventId}/tickets] Supabase error`, error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const tickets = (data ?? [])
      .filter((t) => isAvailableStatus(t?.status))
      .sort((a, b) => (Number(a?.price) || 0) - (Number(b?.price) || 0));

    return NextResponse.json({ tickets });
  } catch (e) {
    return NextResponse.json(
      { error: e?.message || "Unknown error" },
      { status: 500 }
    );
  }
}

