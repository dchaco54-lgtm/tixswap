import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { escapeHtml, sendEmail } from "@/lib/email/resend";
import { createNotification } from "@/lib/notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const requestId = body?.requestId;
    const adminNotes = typeof body?.adminNotes === "string" ? body.adminNotes.trim() : "";

    if (!requestId) {
      return NextResponse.json({ error: "Falta requestId" }, { status: 400 });
    }
    if (!adminNotes) {
      return NextResponse.json({ error: "Faltan notas para rechazar" }, { status: 400 });
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
      .select("id,status,payload,requested_event_name,user_id,user_email,admin_notes")
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

    const base = reqRow.payload && typeof reqRow.payload === "object" ? reqRow.payload : {};
    const nextPayload = { ...base, resolution: { rejectedAt: new Date().toISOString() } };

    const { error: updErr } = await admin
      .from("event_requests")
      .update({
        status: "rejected",
        admin_notes: adminNotes,
        payload: nextPayload,
      })
      .eq("id", requestId);

    if (updErr) {
      return NextResponse.json({ error: updErr.message }, { status: 500 });
    }

    try {
      const sellerEmail = reqRow.user_email || null;
      if (sellerEmail) {
        const safeEvent = escapeHtml(reqRow.requested_event_name || "tu evento");
        const safeNotes = escapeHtml(adminNotes);
        const html = `
          <div style="font-family:Arial,sans-serif;line-height:1.5">
            <h2 style="margin:0 0 12px">Solicitud rechazada</h2>
            <p>Tu solicitud para <b>${safeEvent}</b> fue rechazada.</p>
            <p><b>Motivo:</b> ${safeNotes}</p>
            <p style="color:#666;font-size:12px;margin-top:16px">Este correo es automatico.</p>
          </div>
        `;

        const mailRes = await sendEmail({
          to: sellerEmail,
          subject: "TixSwap - Solicitud rechazada",
          html,
        });
        if (!mailRes.ok && !mailRes.skipped) {
          console.warn("[event-requests/reject] email error:", mailRes.error);
        }
      }
    } catch (mailErr) {
      console.warn("[event-requests/reject] email exception:", mailErr);
    }

    if (reqRow.user_id) {
      await createNotification({
        userId: reqRow.user_id,
        type: "system",
        title: "Solicitud rechazada",
        body: "Tu solicitud de evento fue rechazada.",
        link: "/dashboard",
        metadata: { requestId },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e?.message || "Error inesperado" }, { status: 500 });
  }
}
