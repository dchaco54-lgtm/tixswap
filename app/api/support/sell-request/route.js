import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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
    const apiKey = process.env.RESEND_API_KEY;
    const supportEmail = process.env.SUPPORT_EMAIL || "soporte@tixswap.cl";
    const fromEmail = process.env.RESEND_FROM || "TixSwap <no-reply@tixswap.cl>";

    let emailSent = false;
    let emailError = null;

    if (apiKey) {
      try {
        const html = `
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

        const resp = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: fromEmail,
            to: [supportEmail],
            subject: `Solicitud evento + publicación pendiente (#${reqRow.id})`,
            html,
          }),
        });

        if (!resp.ok) {
          const t = await resp.text().catch(() => "");
          throw new Error(`Resend error: ${resp.status} ${t}`);
        }

        emailSent = true;
      } catch (e) {
        emailError = e?.message || "No se pudo enviar correo (Resend).";
      }
    }

    return NextResponse.json({
      ok: true,
      requestId: reqRow.id,
      emailSent,
      emailError,
    });
  } catch (e) {
    return NextResponse.json({ error: e?.message || "Error inesperado" }, { status: 500 });
  }
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
