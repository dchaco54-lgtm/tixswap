import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { calculateSellerFee } from "@/lib/fees";
import { detectEventColumns, detectTicketColumns } from "@/lib/db/ticketSchema";
import { sendEmail } from "@/lib/email/resend";
import { templateTicketPublished } from "@/lib/email/templates";
import { createNotification } from "@/lib/notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function extractSteps(payload) {
  const base = payload && typeof payload === "object" ? payload : {};
  const step1 = base.step1 && typeof base.step1 === "object" ? base.step1 : base;
  const step2 = base.step2 && typeof base.step2 === "object"
    ? base.step2
    : (base.ticketUpload && typeof base.ticketUpload === "object" ? base.ticketUpload : {});
  const step3 = base.step3 && typeof base.step3 === "object" ? base.step3 : {};
  return { base, step1, step2, step3 };
}

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const requestId = body?.requestId;

    if (!requestId) {
      return NextResponse.json({ error: "Falta requestId" }, { status: 400 });
    }

    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7)
      : authHeader.trim();

    if (!token) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const admin = supabaseAdmin();

    const { data: authData, error: authErr } = await admin.auth.getUser(token);
    if (authErr || !authData?.user) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const adminId = authData.user.id;
    const { data: adminProfile, error: adminProfErr } = await admin
      .from("profiles")
      .select("user_type")
      .eq("id", adminId)
      .maybeSingle();

    if (adminProfErr) {
      return NextResponse.json({ error: adminProfErr.message }, { status: 500 });
    }

    if (adminProfile?.user_type !== "admin") {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }

    const { data: reqRow, error: reqErr } = await admin
      .from("event_requests")
      .select("id,status,payload,requested_event_name,requested_event_extra,user_id,user_email,admin_notes")
      .eq("id", requestId)
      .maybeSingle();

    if (reqErr) {
      return NextResponse.json({ error: reqErr.message }, { status: 500 });
    }

    if (!reqRow) {
      return NextResponse.json({ error: "Solicitud no encontrada" }, { status: 404 });
    }

    if (reqRow.status && reqRow.status !== "pending") {
      return NextResponse.json({ error: "Solicitud ya procesada" }, { status: 409 });
    }

    const { base, step1, step2, step3 } = extractSteps(reqRow.payload);

    const sellerId = reqRow.user_id || base?.userId || null;
    const sellerEmail = reqRow.user_email || base?.userEmail || null;

    if (!sellerId) {
      return NextResponse.json({ error: "Solicitud sin user_id" }, { status: 400 });
    }

    const ticketUploadId = step2?.ticketUploadId || step1?.ticketUploadId || base?.ticketUploadId || null;
    if (!ticketUploadId) {
      return NextResponse.json({ error: "Falta ticketUploadId" }, { status: 400 });
    }

    const priceRaw = step3?.finalPrice ?? step1?.price ?? null;
    const price = Number(priceRaw);
    if (!Number.isFinite(price) || price <= 0) {
      return NextResponse.json({ error: "Precio inválido" }, { status: 400 });
    }

    const originalRaw = step1?.originalPrice ?? step1?.original_price ?? priceRaw;
    const originalPrice = Number(originalRaw);
    const originalPriceFinal = Number.isFinite(originalPrice) && originalPrice > 0 ? originalPrice : price;

    const { data: sellerProfile, error: sellerErr } = await admin
      .from("profiles")
      .select("full_name, email, user_type")
      .eq("id", sellerId)
      .maybeSingle();

    if (sellerErr) {
      return NextResponse.json({ error: sellerErr.message }, { status: 500 });
    }

    const userRole = sellerProfile?.user_type || "standard";
    const platformFee = calculateSellerFee(price, userRole);

    const { data: upload, error: uploadErr } = await admin
      .from("ticket_uploads")
      .select(
        "id,seller_id,is_nominated,is_nominada,storage_bucket,storage_path,validation_status,validation_reason,status"
      )
      .eq("id", ticketUploadId)
      .maybeSingle();

    if (uploadErr) {
      return NextResponse.json({ error: uploadErr.message }, { status: 500 });
    }

    if (!upload || upload.seller_id !== sellerId) {
      return NextResponse.json({ error: "ticketUploadId inválido" }, { status: 400 });
    }

    const validStatuses = new Set(["uploaded", "validated", "approved", "valid"]);
    if (upload.status && !validStatuses.has(upload.status)) {
      return NextResponse.json(
        { error: "ticketUploadId inválido", details: "Estado de upload no válido" },
        { status: 400 }
      );
    }
    if (upload.validation_status && !validStatuses.has(upload.validation_status)) {
      return NextResponse.json(
        { error: "ticketUploadId inválido", details: "Validación no aprobada" },
        { status: 400 }
      );
    }

    const eventColumns = await detectEventColumns(admin);

    let eventId = body?.eventId || null;
    if (typeof eventId === "string") {
      eventId = eventId.trim() || null;
    }
    let eventTitle = null;

    if (eventId) {
      const { data: eventRow, error: eventErr } = await admin
        .from("events")
        .select("id,title")
        .eq("id", eventId)
        .maybeSingle();

      if (eventErr) {
        return NextResponse.json({ error: eventErr.message }, { status: 500 });
      }
      if (!eventRow) {
        return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });
      }

      if (eventColumns?.has("status")) {
        const { error: statusErr } = await admin
          .from("events")
          .update({ status: "published" })
          .eq("id", eventId);
        if (statusErr) {
          return NextResponse.json({ error: statusErr.message }, { status: 500 });
        }
      }

      eventTitle = eventRow.title || null;
    } else {
      const ev = body?.event || {};
      const eventPayload = {
        title: String(ev?.title || "").trim() || null,
        starts_at: ev?.starts_at || null,
        venue: String(ev?.venue || "").trim() || null,
        city: String(ev?.city || "").trim() || null,
        category: String(ev?.category || "").trim() || null,
        image_url: String(ev?.image_url || "").trim() || null,
      };

      if (!eventPayload.title || !eventPayload.starts_at || !eventPayload.venue) {
        return NextResponse.json({ error: "Faltan datos del evento" }, { status: 400 });
      }

      if (eventColumns?.has("status")) {
        eventPayload.status = "published";
      }

      const { data: createdEvent, error: createErr } = await admin
        .from("events")
        .insert(eventPayload)
        .select("id,title")
        .single();

      if (createErr) {
        return NextResponse.json({ error: createErr.message }, { status: 500 });
      }

      eventId = createdEvent.id;
      eventTitle = createdEvent.title || null;
    }

    const ticketColumns = await detectTicketColumns(admin);

    const insertPayload = {
      event_id: eventId,
      seller_id: sellerId,
      seller_name: sellerProfile?.full_name || sellerEmail || "Vendedor",
      seller_email: sellerProfile?.email || sellerEmail || null,
      price,
      original_price: originalPriceFinal,
      platform_fee: platformFee,
      status: "active",
      sale_type: "fixed",
      sector: step1?.sector || null,
      row_label: step1?.fila || null,
      seat_label: step1?.asiento || null,
    };

    if (ticketColumns?.has("description")) {
      insertPayload.description = step1?.description || null;
    }

    if (ticketColumns?.has("ticket_upload_id")) insertPayload.ticket_upload_id = ticketUploadId;
    if (ticketColumns?.has("upload_bucket")) insertPayload.upload_bucket = upload.storage_bucket ?? null;
    if (ticketColumns?.has("upload_path")) insertPayload.upload_path = upload.storage_path ?? null;

    const nominated = upload.is_nominated ?? upload.is_nominada ?? false;
    if (ticketColumns?.has("is_nominated")) insertPayload.is_nominated = nominated;
    if (ticketColumns?.has("is_nominada")) insertPayload.is_nominada = nominated;

    const { data: createdTicket, error: insertErr } = await admin
      .from("tickets")
      .insert(insertPayload)
      .select("*")
      .single();

    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    const notesRaw = typeof body?.adminNotes === "string" ? body.adminNotes.trim() : null;
    const nextNotes = notesRaw !== null ? (notesRaw || null) : (reqRow.admin_notes || null);

    const resolution = {
      eventId,
      ticketId: createdTicket.id,
      approvedAt: new Date().toISOString(),
    };
    const nextPayload = base && typeof base === "object" ? { ...base, resolution } : { resolution };

    const { error: updErr } = await admin
      .from("event_requests")
      .update({
        status: "approved",
        admin_notes: nextNotes,
        payload: nextPayload,
      })
      .eq("id", requestId);

    if (updErr) {
      return NextResponse.json({ error: updErr.message }, { status: 500 });
    }

    try {
      const sellerMail = sellerProfile?.email || sellerEmail;
      if (sellerMail) {
        const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://tixswap.cl").replace(/\/+$/, "");
        const link = `${baseUrl}/dashboard/publications/${createdTicket.id}`;
        const { subject, html } = templateTicketPublished({
          sellerName: sellerProfile?.full_name || null,
          ticketId: createdTicket.id,
          eventName: eventTitle,
          price: createdTicket.price,
          link,
          sector: createdTicket.sector || step1?.sector || null,
          sectionLabel: createdTicket.section_label || null,
          rowLabel: createdTicket.row_label || step1?.fila || null,
          seatLabel: createdTicket.seat_label || step1?.asiento || null,
        });

        const mailRes = await sendEmail({ to: sellerMail, subject, html });
        if (!mailRes.ok && !mailRes.skipped) {
          console.warn("[event-requests/approve] email error:", mailRes.error);
        }
      }
    } catch (mailErr) {
      console.warn("[event-requests/approve] email exception:", mailErr);
    }

    await createNotification({
      userId: sellerId,
      type: "system",
      title: "Publicación creada",
      body: "Tu entrada quedó publicada.",
      link: `/dashboard/publications/${createdTicket.id}`,
      metadata: { ticketId: createdTicket.id, eventId },
    });

    return NextResponse.json({ ok: true, eventId, ticketId: createdTicket.id });
  } catch (e) {
    return NextResponse.json({ error: e?.message || "Error inesperado" }, { status: 500 });
  }
}
