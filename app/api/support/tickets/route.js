import { NextResponse } from "next/server";

export const runtime = "nodejs";

function mapTicketCode(ticket) {
  if (!ticket || typeof ticket !== "object") return ticket;
  const next = { ...ticket };
  if (!next.code && next.ticket_number) {
    next.code = `TS-${next.ticket_number}`;
  }
  if (!next.kind) {
    const category = String(next.category || "").toLowerCase().trim();
    next.kind = category.startsWith("disputa") ? "dispute" : "support";
  }
  return next;
}

async function forwardJson(req, targetUrl, method, body) {
  const headers = new Headers(req.headers);
  headers.set("Content-Type", "application/json");
  const res = await fetch(targetUrl, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return { res, json };
}

export async function GET(req) {
  const url = new URL(req.url);
  const target = new URL("/support/my/tickets", url.origin);
  target.search = url.search;

  const res = await fetch(target.toString(), {
    headers: req.headers,
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    return NextResponse.json({ error: json?.error || "No autorizado" }, { status: res.status });
  }

  const list = Array.isArray(json.tickets) ? json.tickets : [];
  const mapped = list.map(mapTicketCode);

  return NextResponse.json({ tickets: mapped });
}

export async function POST(req) {
  const url = new URL(req.url);
  const body = await req.json().catch(() => ({}));

  const payload = {
    category: body?.category || (body?.kind === "dispute" ? "disputa_compra" : "soporte"),
    subject: body?.subject,
    message: body?.message ?? body?.body ?? body?.text,
    order_id: body?.order_id || body?.orderId || null,
  };

  const createTarget = new URL("/support/create", url.origin);
  const { res: createRes, json: createJson } = await forwardJson(req, createTarget.toString(), "POST", payload);

  if (!createRes.ok) {
    return NextResponse.json({ error: createJson?.error || "No se pudo crear" }, { status: createRes.status });
  }

  const ticketId = createJson?.ticket_id;
  if (!ticketId) {
    return NextResponse.json({ ticket: null });
  }

  const detailTarget = new URL("/support/my/ticket", url.origin);
  detailTarget.searchParams.set("id", ticketId);

  const detailRes = await fetch(detailTarget.toString(), { headers: req.headers });
  const detailJson = await detailRes.json().catch(() => ({}));

  if (!detailRes.ok) {
    return NextResponse.json({ ticket: { id: ticketId } });
  }

  const ticket = mapTicketCode(detailJson?.ticket || null);
  return NextResponse.json({ ticket });
}
