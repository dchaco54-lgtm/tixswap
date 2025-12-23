import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

export async function POST(req) {
  try {
    const body = await req.json();

    const requestedName = String(body?.requestedEventName || "").trim();
    if (!requestedName) {
      return NextResponse.json({ error: "Falta nombre del evento." }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const insertObj = {
      user_id: body.userId ?? null,
      user_email: body.userEmail ?? null,
      requested_event_name: requestedName,
      requested_event_extra: String(body?.requestedEventExtra || "").trim() || null,
      payload: body,
      status: "pending",
    };

    const { data: reqRow, error } = await supabase
      .from("event_requests")
      .insert(insertObj)
      .select("id, created_at")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const resend = new Resend(process.env.RESEND_API_KEY);

    await resend.emails.send({
      from: "TixSwap <no-reply@tixswap.cl>",
      to: ["soporte@tixswap.cl"],
      subject: `Solicitud evento + publicación pendiente (#${reqRow.id})`,
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.4;">
          <h2>Solicitud de creación de evento</h2>
          <p><b>ID:</b> ${reqRow.id}</p>
          <p><b>Evento solicitado:</b> ${escapeHtml(requestedName)}</p>
          <p><b>Extra:</b> ${escapeHtml(insertObj.requested_event_extra || "-")}</p>
          <hr/>
          <p><b>Payload completo:</b></p>
          <pre style="white-space: pre-wrap; background:#f6f7f9; padding:12px; border-radius:10px;">${escapeHtml(
            JSON.stringify(body, null, 2)
          )}</pre>
        </div>
      `,
    });

    return NextResponse.json({ ok: true, requestId: reqRow.id });
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
