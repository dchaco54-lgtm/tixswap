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

export async function GET(req, { params }) {
  const id = params?.id;
  if (!id) return NextResponse.json({ error: "Falta id" }, { status: 400 });

  const url = new URL(req.url);
  const target = new URL("/support/my/ticket", url.origin);
  target.searchParams.set("id", id);

  const res = await fetch(target.toString(), { headers: req.headers });
  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    return NextResponse.json({ error: json?.error || "No autorizado" }, { status: res.status });
  }

  const ticket = mapTicketCode(json?.ticket || null);
  return NextResponse.json({ ticket, messages: json?.messages || [], attachments: json?.attachments || [] });
}
