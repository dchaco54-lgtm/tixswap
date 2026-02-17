import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || "")
  );
}

async function getAuthUser(request) {
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : "";

  if (!token) return { user: null };

  const admin = supabaseAdmin();
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user) {
    return { user: null };
  }

  return { user: data.user };
}

export async function GET(request, { params }) {
  try {
    const eventId = params?.id;
    if (!eventId || !isUuid(eventId)) {
      return NextResponse.json({ error: "Evento inválido" }, { status: 400 });
    }

    const { user } = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const admin = supabaseAdmin();
    const { data, error } = await admin
      .from("event_alert_subscriptions")
      .select("id")
      .eq("event_id", eventId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ subscribed: Boolean(data) });
  } catch (err) {
    return NextResponse.json(
      { error: err?.message || "Error inesperado" },
      { status: 500 }
    );
  }
}

export async function POST(request, { params }) {
  try {
    const eventId = params?.id;
    if (!eventId || !isUuid(eventId)) {
      return NextResponse.json({ error: "Evento inválido" }, { status: 400 });
    }

    const { user } = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const admin = supabaseAdmin();
    const payload = { user_id: user.id, event_id: eventId };

    const { error } = await admin
      .from("event_alert_subscriptions")
      .upsert(payload, { onConflict: "user_id,event_id" });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ subscribed: true });
  } catch (err) {
    return NextResponse.json(
      { error: err?.message || "Error inesperado" },
      { status: 500 }
    );
  }
}

export async function DELETE(request, { params }) {
  try {
    const eventId = params?.id;
    if (!eventId || !isUuid(eventId)) {
      return NextResponse.json({ error: "Evento inválido" }, { status: 400 });
    }

    const { user } = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const admin = supabaseAdmin();
    const { error } = await admin
      .from("event_alert_subscriptions")
      .delete()
      .eq("event_id", eventId)
      .eq("user_id", user.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ subscribed: false });
  } catch (err) {
    return NextResponse.json(
      { error: err?.message || "Error inesperado" },
      { status: 500 }
    );
  }
}
