import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req) {
  try {
    const auth = req.headers.get("authorization") || "";
    const token = auth.replace("Bearer ", "").trim();
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { orderId } = await req.json();
    if (!orderId) {
      return NextResponse.json({ error: "Missing orderId" }, { status: 400 });
    }

    const admin = supabaseAdmin();

    // 1) Validar usuario (token supabase)
    const { data: userData, error: uErr } = await admin.auth.getUser(token);
    const user = userData?.user;
    if (uErr || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2) Traer orden del usuario
    const { data: order, error: oErr } = await admin
      .from("orders")
      .select("id, user_id, ticket_id, status")
      .eq("id", orderId)
      .single();

    if (oErr || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    if (order.user_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (order.status !== "paid") {
      return NextResponse.json(
        { error: "Order not paid" },
        { status: 400 }
      );
    }

    // 3) Ticket (select * para no depender del nombre exacto del campo)
    const { data: ticket, error: tErr } = await admin
      .from("tickets")
      .select("*")
      .eq("id", order.ticket_id)
      .single();

    if (tErr || !ticket) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    const fileUrl =
      ticket.file_url ||
      ticket.download_url ||
      ticket.pdf_url ||
      ticket.storage_path ||
      ticket.file_path ||
      ticket.filepath ||
      "";

    if (!fileUrl) {
      return NextResponse.json(
        { error: "Ticket file not available (missing file url)" },
        { status: 400 }
      );
    }

    // Si guardas una URL directa, devolvemos esa.
    // Si guardas un path de storage, también lo devolvemos tal cual (tu frontend puede abrirlo).
    return NextResponse.json({ url: fileUrl });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e?.message || "Unknown error" },
      { status: 500 }
    );
  }
}
