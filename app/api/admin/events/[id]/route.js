import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getUserFromBearer, isAdminUser } from "@/lib/support/auth";
import { createNotification } from "@/lib/notifications";
import { sendEmail } from "@/lib/email/resend";
import { templateEventUpdated } from "@/lib/email/templates";
import { getEventAudience } from "@/lib/events/audience";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const ALLOWED_FIELDS = ["title", "starts_at", "venue", "city", "image_url"];

const FIELD_LABELS = {
  title: "Nombre del evento",
  starts_at: "Fecha y hora",
  venue: "Recinto",
  city: "Ciudad",
  image_url: "Imagen/banner",
};

const CHANGE_TYPE_LABELS = {
  reprogramado: "Reprogramado",
  recinto: "Cambio de recinto",
  menor: "Actualización menor",
  otro: "Otro",
};

const EMAIL_WINDOW_MS = 30 * 60 * 1000;
const SPAM_WINDOW_MS = 10 * 60 * 1000;
const SPAM_LIMIT = 3;

function normalizeString(value) {
  const str = String(value ?? "").trim();
  return str || null;
}

function normalizeStartsAt(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function normalizeField(field, value) {
  if (field === "starts_at") return normalizeStartsAt(value);
  return normalizeString(value);
}

function formatDateTime(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  try {
    return new Intl.DateTimeFormat("es-CL", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(d);
  } catch {
    return d.toISOString();
  }
}

function formatFieldValue(field, value) {
  if (field === "starts_at") return formatDateTime(value);
  return value ?? "—";
}

function normalizeChangeType(value) {
  const t = String(value || "").toLowerCase().trim();
  if (t === "reprogramado" || t === "recinto" || t === "menor" || t === "otro") return t;
  return "menor";
}

function buildDiff(current, updates) {
  const changedFields = [];
  const oldValues = {};
  const newValues = {};

  ALLOWED_FIELDS.forEach((field) => {
    if (!(field in updates)) return;
    const oldValue = normalizeField(field, current?.[field]);
    const newValue = normalizeField(field, updates?.[field]);
    if (oldValue === newValue) return;
    changedFields.push(field);
    oldValues[field] = oldValue;
    newValues[field] = newValue;
  });

  return { changedFields, oldValues, newValues };
}

function parseBoolean(value, fallback = false) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value.toLowerCase() === "true";
  return fallback;
}

function normalizeAdminEmails() {
  return String(process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((email) => String(email || "").trim().toLowerCase())
    .filter(Boolean);
}

async function ensureAdmin(req, admin) {
  const { user, error } = await getUserFromBearer(req, admin);
  if (!user || error) return { ok: false, error: "UNAUTHORIZED" };

  const { ok, profile } = await isAdminUser(admin, user);
  if (ok) return { ok: true, user, profile };

  const email = String(user.email || "").toLowerCase().trim();
  const allowlist = new Set(normalizeAdminEmails());
  if (email && allowlist.has(email)) return { ok: true, user, profile: null };

  return { ok: false, error: "FORBIDDEN" };
}

async function shouldSuppressEmails(admin, eventId) {
  const since = new Date(Date.now() - SPAM_WINDOW_MS).toISOString();
  const { data, error } = await admin
    .from("event_change_logs")
    .select("id")
    .eq("event_id", eventId)
    .gte("created_at", since);

  if (error) return { suppressed: false };
  return { suppressed: (data || []).length >= SPAM_LIMIT };
}

function buildChangesForEmail(changedFields, oldValues, newValues) {
  return changedFields.map((field) => ({
    label: FIELD_LABELS[field] || field,
    before: formatFieldValue(field, oldValues[field]),
    after: formatFieldValue(field, newValues[field]),
  }));
}

async function sendNotifications({ recipients, eventId, eventTitle, changedFields, changeType }) {
  const body = eventTitle
    ? `${eventTitle} fue actualizado. Revisa los cambios.`
    : "Un evento fue actualizado. Revisa los cambios.";

  await Promise.all(
    recipients.map((userId) =>
      createNotification({
        userId,
        type: "event_updated",
        title: "Evento actualizado",
        body,
        link: `/events/${eventId}`,
        metadata: {
          eventId,
          changedFields,
          changeType,
        },
      })
    )
  );
}

async function sendUpdateEmails({
  admin,
  recipients,
  profilesById,
  eventId,
  eventTitle,
  changeType,
  changeTypeDetail,
  messageToUsers,
  changedFields,
  oldValues,
  newValues,
}) {
  const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.tixswap.cl").replace(/\/+$/, "");
  const supportWhatsapp = process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP || "";
  const link = `${baseUrl}/events/${eventId}`;

  const emailLogsToUpsert = [];
  const nowIso = new Date().toISOString();

  const changes = buildChangesForEmail(changedFields, oldValues, newValues);
  const typeLabel = CHANGE_TYPE_LABELS[changeType] || changeType;

  for (const userId of recipients) {
    const profile = profilesById[userId];
    const email = profile?.email || null;
    if (!email) continue;

    const { subject, html } = templateEventUpdated({
      recipientName: profile?.full_name || null,
      eventName: eventTitle,
      changeType: typeLabel,
      changeTypeDetail,
      changes,
      messageToUsers,
      link,
      supportWhatsapp,
    });

    const res = await sendEmail({ to: email, subject, html });
    if (res?.ok) {
      emailLogsToUpsert.push({ event_id: eventId, user_id: userId, last_sent_at: nowIso });
    } else if (res && !res.skipped) {
      console.warn("[admin/events] email error:", res.error);
    }
  }

  if (emailLogsToUpsert.length) {
    await admin
      .from("event_update_email_log")
      .upsert(emailLogsToUpsert, { onConflict: "event_id,user_id" });
  }
}

export async function PUT(req, { params }) {
  try {
    const eventId = params?.id;
    if (!eventId) {
      return NextResponse.json({ error: "Evento inválido" }, { status: 400 });
    }

    const admin = supabaseAdmin();
    const auth = await ensureAdmin(req, admin);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.error === "FORBIDDEN" ? 403 : 401 });
    }

    const body = await req.json().catch(() => ({}));
    const updatesRaw = body?.updates && typeof body.updates === "object" ? body.updates : {};

    const updates = {};
    ALLOWED_FIELDS.forEach((field) => {
      if (field in updatesRaw) {
        updates[field] = updatesRaw[field];
      }
    });

    if (!Object.keys(updates).length) {
      return NextResponse.json({ error: "No hay cambios" }, { status: 400 });
    }

    const requiredFields = ["title", "starts_at"];
    for (const field of requiredFields) {
      if (field in updates) {
        const normalized = normalizeField(field, updates[field]);
        if (!normalized) {
          return NextResponse.json({ error: "Faltan campos obligatorios" }, { status: 400 });
        }
      }
    }

    const { data: eventRow, error: eventErr } = await admin
      .from("events")
      .select("id, title, starts_at, venue, city, image_url")
      .eq("id", eventId)
      .maybeSingle();

    if (eventErr) {
      console.error("[admin/events] load error:", eventErr);
      return NextResponse.json({ error: "No pudimos cargar el evento" }, { status: 500 });
    }

    if (!eventRow) {
      return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });
    }

    const { changedFields, oldValues, newValues } = buildDiff(eventRow, updates);

    if (!changedFields.length) {
      return NextResponse.json({ error: "No hay cambios para guardar" }, { status: 400 });
    }

    const updatePayload = {};
    changedFields.forEach((field) => {
      updatePayload[field] = newValues[field];
    });

    const { error: updateErr } = await admin
      .from("events")
      .update(updatePayload)
      .eq("id", eventId);

    if (updateErr) {
      console.error("[admin/events] update error:", updateErr);
      return NextResponse.json({ error: "No pudimos guardar el evento" }, { status: 500 });
    }

    const changeType = normalizeChangeType(body?.changeType);
    const changeTypeDetail = normalizeString(body?.changeTypeDetail);
    const messageToUsers = normalizeString(body?.messageToUsers);

    const notifyBuyers = parseBoolean(body?.notifyBuyers, true);
    const notifySubscribers = parseBoolean(body?.notifySubscribers, true);
    const notifySellers = parseBoolean(body?.notifySellers, false);

    let audience = {
      buyers: new Set(),
      subscribers: new Set(),
      sellers: new Set(),
      total: new Set(),
      buyersCount: 0,
      subscribersCount: 0,
      sellersCount: 0,
      totalUniqueCount: 0,
    };

    if (notifyBuyers || notifySubscribers || notifySellers) {
      try {
        audience = await getEventAudience(admin, eventId, { includeSellers: notifySellers });
      } catch (audienceErr) {
        console.error("[admin/events] audience error:", audienceErr);
      }
    }

    const notifyRecipients = new Set();
    if (notifyBuyers) audience.buyers.forEach((id) => notifyRecipients.add(id));
    if (notifySubscribers) audience.subscribers.forEach((id) => notifyRecipients.add(id));
    if (notifySellers) audience.sellers.forEach((id) => notifyRecipients.add(id));

    const recipients = Array.from(notifyRecipients);
    const shouldNotify = recipients.length > 0 && (notifyBuyers || notifySubscribers || notifySellers);

    const { data: logRow, error: logErr } = await admin
      .from("event_change_logs")
      .insert({
        event_id: eventId,
        changed_by_admin_id: auth.user.id,
        change_type: changeType,
        change_type_detail: changeTypeDetail,
        message_to_users: messageToUsers,
        old_values: oldValues,
        new_values: newValues,
        changed_fields: changedFields,
        notified: shouldNotify,
      })
      .select("id")
      .single();

    if (logErr) {
      console.error("[admin/events] log error:", logErr);
      return NextResponse.json({ error: "No pudimos registrar cambios" }, { status: 500 });
    }

    let emailSuppressed = false;
    if (shouldNotify) {
      try {
        await sendNotifications({
          recipients,
          eventId,
          eventTitle: eventRow.title || null,
          changedFields,
          changeType,
        });
      } catch (notifErr) {
        console.warn("[admin/events] notification error:", notifErr);
      }

      const { suppressed } = await shouldSuppressEmails(admin, eventId);
      emailSuppressed = suppressed;

      if (!emailSuppressed) {
        try {
          const { data: profiles } = await admin
            .from("profiles")
            .select("id, email, full_name")
            .in("id", recipients);

          const profilesById = (profiles || []).reduce((acc, p) => {
            acc[p.id] = p;
            return acc;
          }, {});

          const { data: emailLogs } = await admin
            .from("event_update_email_log")
            .select("user_id, last_sent_at")
            .eq("event_id", eventId)
            .in("user_id", recipients);

          const lastByUser = new Map(
            (emailLogs || []).map((row) => [row.user_id, row.last_sent_at])
          );

          const eligibleRecipients = recipients.filter((userId) => {
            const lastSent = lastByUser.get(userId);
            if (!lastSent) return true;
            const lastTime = new Date(lastSent).getTime();
            return Number.isFinite(lastTime) && Date.now() - lastTime >= EMAIL_WINDOW_MS;
          });

          if (eligibleRecipients.length) {
            await sendUpdateEmails({
              admin,
              recipients: eligibleRecipients,
              profilesById,
              eventId,
              eventTitle: eventRow.title || null,
              changeType,
              changeTypeDetail,
              messageToUsers,
              changedFields,
              oldValues,
              newValues,
            });
          }
        } catch (mailErr) {
          console.warn("[admin/events] email exception:", mailErr);
        }
      }
    }

    return NextResponse.json({
      ok: true,
      eventId,
      changeLogId: logRow?.id || null,
      changedFields,
      notified: shouldNotify,
      emailSuppressed,
      audience: {
        buyersCount: audience.buyersCount,
        subscribersCount: audience.subscribersCount,
        sellersCount: audience.sellersCount,
        totalUniqueCount: audience.totalUniqueCount,
      },
    });
  } catch (err) {
    console.error("[admin/events] PUT error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
