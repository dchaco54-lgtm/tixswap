import { NextResponse } from "next/server";

export const runtime = "nodejs";

async function postJson(req, targetUrl, payload) {
  const headers = new Headers(req.headers);
  headers.set("Content-Type", "application/json");
  const res = await fetch(targetUrl, {
    method: "POST",
    headers,
    body: JSON.stringify(payload || {}),
  });
  const json = await res.json().catch(() => ({}));
  return { res, json };
}

export async function POST(req, { params }) {
  const id = params?.id;
  if (!id) return NextResponse.json({ error: "Falta id" }, { status: 400 });

  const authHeader = req.headers.get("authorization") || "";
  if (!authHeader) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const url = new URL(req.url);
  const origin = url.origin;
  const contentType = req.headers.get("content-type") || "";

  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    const message = String(form.get("body") || form.get("message") || "").trim();
    const files = form.getAll("files");
    const attachmentIds = [];

    for (const f of files) {
      if (!(f instanceof File)) continue;
      const fd = new FormData();
      fd.append("ticketId", id);
      fd.append("file", f);

      const uploadRes = await fetch(`${origin}/support/upload`, {
        method: "POST",
        headers: { Authorization: authHeader },
        body: fd,
      });

      const uploadJson = await uploadRes.json().catch(() => ({}));
      if (!uploadRes.ok) {
        return NextResponse.json(
          { error: uploadJson?.error || "Upload falló" },
          { status: uploadRes.status }
        );
      }

      if (uploadJson?.attachment?.id) attachmentIds.push(uploadJson.attachment.id);
    }

    const payload = {
      ticket_id: id,
      message,
      attachment_ids: attachmentIds,
    };

    const { res, json } = await postJson(req, `${origin}/support/message`, payload);
    if (!res.ok) {
      return NextResponse.json({ error: json?.error || "No se pudo enviar" }, { status: res.status });
    }

    return NextResponse.json({
      message: json?.message || null,
      attachments: json?.attachments || [],
      status: json?.status,
    });
  }

  const body = await req.json().catch(() => ({}));
  const payload = {
    ticket_id: id,
    message: body?.message ?? body?.body ?? body?.text ?? "",
    attachment_ids: Array.isArray(body?.attachment_ids) ? body.attachment_ids : [],
    reopen: body?.reopen === true,
  };

  const { res, json } = await postJson(req, `${origin}/support/message`, payload);
  if (!res.ok) {
    return NextResponse.json({ error: json?.error || "No se pudo enviar" }, { status: res.status });
  }

  return NextResponse.json({
    message: json?.message || null,
    attachments: json?.attachments || [],
    status: json?.status,
  });
}
