import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

import { sendEmail } from "@/lib/email/resend";
import { templateEventAlertSubscribed } from "@/lib/email/templates";
import { createNotification } from "@/lib/notifications";
import { syncProfileFromAuthUser } from "@/lib/profileCompletionServer";
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
    .select("id,title,venue,city")
    .eq("id", eventId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "No pudimos validar el evento.");
  }

  return data || null;
}

async function notifySubscriptionCreated({ admin, user, eventRow }) {
  try {
    const profile = await syncProfileFromAuthUser(admin, user).catch(() => null);
    const eventName = eventRow?.title || "este evento";
    const eventLink = `/events/${eventRow.id}`;

    await createNotification({
      userId: user.id,
      type: "event_alert_subscribed",
      title: "Alerta activada",
      body: `Te avisaremos cuando haya nuevas entradas para ${eventName}.`,
      link: eventLink,
      metadata: { eventId: eventRow.id },
    });

    const recipientEmail = profile?.email || user.email || null;
    if (!recipientEmail) {
      console.warn("[event-alerts] confirm email skipped:", {
        eventId: eventRow.id,
        userId: user.id,
        reason: "missing_recipient_email",
      });
      return;
    }

    const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://tixswap.cl").replace(/\/+$/, "");
    const { subject, html } = templateEventAlertSubscribed({
      recipientName: profile?.full_name || null,
      eventName: eventRow?.title || null,
      link: `${baseUrl}${eventLink}`,
      venue: eventRow?.venue || null,
      city: eventRow?.city || null,
    });

    const mailRes = await sendEmail({ to: recipientEmail, subject, html });
    if (mailRes.ok) return;

    if (mailRes.skipped) {
      console.warn("[event-alerts] confirm email skipped:", {
        eventId: eventRow.id,
        userId: user.id,
        reason: mailRes.reason || "unknown",
      });
      return;
    }

    console.warn("[event-alerts] confirm email error:", {
      eventId: eventRow.id,
      userId: user.id,
      error: mailRes.error || "unknown",
    });
  } catch (err) {
    console.warn("[event-alerts] confirm notification error:", err);
  }
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
    const eventRow = await ensureEventExists(admin, eventId);
    if (!eventRow) {
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
    const eventRow = await ensureEventExists(admin, eventId);
    if (!eventRow) {
      return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });
    }

    const { data: existingSub, error: existingErr } = await admin
      .from("event_alert_subscriptions")
      .select("id")
      .eq("event_id", eventId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (existingErr) {
      return NextResponse.json({ error: existingErr.message }, { status: 500 });
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

    if (!existingSub?.id) {
      await notifySubscriptionCreated({ admin, user, eventRow });
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
    const eventRow = await ensureEventExists(admin, eventId);
    if (!eventRow) {
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
