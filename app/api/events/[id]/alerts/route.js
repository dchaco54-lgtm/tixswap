import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || "")
  );
}

function buildChannelsResponse(subscribed) {
  return {
    subscribed,
    channels: {
      email: true,
      inApp: true,
    },
  };
}

async function getAuthUser(request) {
  const authHeader = request.headers.get("authorization") || "";
  if (authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice(7).trim();

    if (token) {
      try {
        const admin = supabaseAdmin();
        const { data, error } = await admin.auth.getUser(token);
        if (!error && data?.user) {
          return { user: data.user };
        }
      } catch {
        // fallback a cookies
      }
    }
  }

  const supabase = createRouteHandlerClient({ cookies });
  const { data } = await supabase.auth.getUser();
  return { user: data?.user || null };
}

async function ensureEventExists(admin, eventId) {
  const { data, error } = await admin
    .from("events")
    .select("id")
    .eq("id", eventId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "No pudimos validar el evento.");
  }

  return Boolean(data?.id);
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
    const eventExists = await ensureEventExists(admin, eventId);
    if (!eventExists) {
      return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });
    }

    const { data, error } = await admin
      .from("event_alert_subscriptions")
      .select("id")
      .eq("event_id", eventId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(buildChannelsResponse(Boolean(data)));
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
    const eventExists = await ensureEventExists(admin, eventId);
    if (!eventExists) {
      return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });
    }

    const { error } = await admin
      .from("event_alert_subscriptions")
      .upsert(
        {
          user_id: user.id,
          event_id: eventId,
        },
        { onConflict: "user_id,event_id" }
      );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      ...buildChannelsResponse(true),
    });
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
    const eventExists = await ensureEventExists(admin, eventId);
    if (!eventExists) {
      return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });
    }

    const { error } = await admin
      .from("event_alert_subscriptions")
      .delete()
      .eq("event_id", eventId)
      .eq("user_id", user.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      ...buildChannelsResponse(false),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err?.message || "Error inesperado" },
      { status: 500 }
    );
  }
}
