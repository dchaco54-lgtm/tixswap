import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { env, escapeHtml, sendEmail } from "@/lib/email/resend";
import { templateSellRequestReceived } from "@/lib/email/templates";
import { createNotification } from "@/lib/notifications";

/**
 * POST /api/support/sell-request
 * Guarda una solicitud de creación de evento + publicación pendiente.
 * (Opcional) Envía un correo a soporte vía Resend REST API (sin dependencia npm).
 *
 * Env vars:
 * - NEXT_PUBLIC_SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY   (server only)
 * - RESEND_API_KEY              (opcional)
 * - SUPPORT_EMAIL               (opcional, default: soporte@tixswap.cl)
 * - RESEND_FROM                 (opcional, default: TixSwap <no-reply@tixswap.cl>)
 */
export async function POST(req) {
  try {
    const body = await req.json();

    const requestedName = String(body?.requestedEventName || "").trim();
    if (!requestedName) {
      return NextResponse.json({ error: "Falta nombre del evento." }, { status: 400 });
    }

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        {
          error:
            "Faltan variables de entorno de Supabase (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).",
        },
        { status: 500 }
      );
    }

    // ✅ Supabase (service role SOLO en server)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const insertObj = {
      user_id: body.userId ?? null,
      user_email: body.userEmail ?? null,
      requested_event_name: requestedName,
      requested_event_extra: String(body?.requestedEventExtra || "").trim() || null,
      payload: body, // guarda TODO lo que venga desde los 3 pasos
      status: "pending",
    };

    const { data: reqRow, error: insErr } = await supabase
      .from("event_requests")
      .insert(insertObj)
      .select("id, created_at")
      .single();

    if (insErr) {
      return NextResponse.json({ error: insErr.message }, { status: 500 });
    }

    // ✅ Email a soporte (OPCIONAL)
    const supportEmail =
      env("SUPPORT_EMAIL") || env("SUPPORT_INBOX_EMAIL") || "soporte@tixswap.cl";

    let emailSent = false;
    let emailError = null;
    let userEmailSent = false;
    let userEmailError = null;

    const supportHtml = `
      <div style="font-family: Arial, sans-serif; line-height: 1.45;">
        <h2 style="margin:0 0 8px 0;">Solicitud de creación de evento</h2>
        <p style="margin:0 0 6px 0;"><b>ID:</b> ${reqRow.id}</p>
        <p style="margin:0 0 6px 0;"><b>Evento solicitado:</b> ${escapeHtml(requestedName)}</p>
        <p style="margin:0 0 12px 0;"><b>Extra:</b> ${escapeHtml(insertObj.requested_event_extra || "-")}</p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:12px 0;" />
        <p style="margin:0 0 8px 0;"><b>Payload completo (3 pasos):</b></p>
        <pre style="white-space: pre-wrap; background:#f6f7f9; padding:12px; border-radius:10px; margin:0;">${escapeHtml(
          JSON.stringify(body, null, 2)
        )}</pre>
      </div>
    `;

    try {
      const supportRes = await sendEmail({
        to: supportEmail,
        subject: `Solicitud evento + publicación pendiente (#${reqRow.id})`,
        html: supportHtml,
      });

      if (supportRes.ok) {
        emailSent = true;
      } else if (!supportRes.skipped) {
        emailError = supportRes.error || "No se pudo enviar correo (Resend).";
      }
    } catch (e) {
      emailError = e?.message || "No se pudo enviar correo (Resend).";
    }

    if (body?.userEmail) {
      try {
        const baseUrl = (env("NEXT_PUBLIC_SITE_URL") || "https://tixswap.cl").replace(/\/+$/, "");
        const link = baseUrl ? `${baseUrl}/dashboard` : null;
        const { subject, html } = templateSellRequestReceived({
          sellerName: body?.userName || null,
          requestedEventName: requestedName,
          requestId: reqRow.id,
          link,
        });

        const userRes = await sendEmail({
          to: body.userEmail,
          subject,
          html,
        });

        if (userRes.ok) {
          userEmailSent = true;
        } else if (!userRes.skipped) {
          userEmailError = userRes.error || "No se pudo enviar correo (Resend).";
        }
      } catch (e) {
        userEmailError = e?.message || "No se pudo enviar correo (Resend).";
      }
    }

    if (insertObj.user_id) {
      await createNotification({
        userId: insertObj.user_id,
        type: "system",
        title: "Solicitud recibida",
        body: `Recibimos tu solicitud para ${requestedName}.`,
        link: "/dashboard",
        metadata: { requestId: reqRow.id },
      });
    }

    return NextResponse.json({
      ok: true,
      requestId: reqRow.id,
      emailSent,
      emailError,
      userEmailSent,
      userEmailError,
    });
  } catch (e) {
    return NextResponse.json({ error: e?.message || "Error inesperado" }, { status: 500 });
  }
}
