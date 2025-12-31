import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { calcFees, getFeeRatesForRole } from "@/lib/fees";

function getBearerToken(req) {
  const h = req.headers.get("authorization") || "";
  if (!h.toLowerCase().startsWith("bearer ")) return null;
  return h.slice(7).trim();
}

export async function GET(req) {
  try {
    const url = new URL(req.url);

    // aceptamos ticket o ticketId (por si cambia el front)
    const ticketId =
      url.searchParams.get("ticket") || url.searchParams.get("ticketId");

    if (!ticketId) {
      return NextResponse.json(
        { error: "Falta ticket (o ticketId)." },
        { status: 400 }
      );
    }

    // ✅ Auth por Bearer token (tu sesión está en localStorage)
    const token = getBearerToken(req);
    if (!token) {
      return NextResponse.json({ error: "No autenticado." }, { status: 401 });
    }

    // Validamos el token con ANON (no dependemos del service role para auth)
    const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!sbUrl || !anonKey) {
      return NextResponse.json(
        {
          error:
            "Faltan variables NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY.",
        },
        { status: 500 }
      );
    }

    const authClient = createClient(sbUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: userRes, error: uErr } = await authClient.auth.getUser(token);
    const user = userRes?.user;

    if (uErr || !user) {
      return NextResponse.json({ error: "No autenticado." }, { status: 401 });
    }

    // ✅ Leer ticket con service-role (evita RLS)
    const admin = supabaseAdmin();

    const { data: ticket, error: tErr } = await admin
      .from("tickets")
      .select("*, event:events(*)")
      .eq("id", ticketId)
      .maybeSingle();

    if (tErr) {
      return NextResponse.json(
        { error: tErr.message || "No se pudo leer el ticket (service role)." },
        { status: 500 }
      );
    }

    if (!ticket) {
      return NextResponse.json({ error: "Ticket no encontrado." }, { status: 404 });
    }

    if (ticket.status && ticket.status !== "active") {
      return NextResponse.json(
        { error: `Ticket no disponible (status: ${ticket.status}).` },
        { status: 400 }
      );
    }

    // Si viene embed del evento por el join, lo usamos. Si no, lo buscamos.
    let event = ticket.event || null;
    if (!event && ticket.event_id) {
      const { data: eData, error: eErr } = await admin
        .from("events")
        .select("*")
        .eq("id", ticket.event_id)
        .maybeSingle();

      if (eErr) {
        return NextResponse.json(
          { error: eErr.message || "Error leyendo evento." },
          { status: 500 }
        );
      }
      event = eData || null;
    }

    if (!event) {
      return NextResponse.json({ error: "Evento no encontrado." }, { status: 404 });
    }

    const [{ data: buyerProfile }, { data: sellerProfile }] = await Promise.all([
      admin.from("profiles").select("role").eq("id", user.id).maybeSingle(),
      admin.from("profiles").select("role").eq("id", ticket.seller_id).maybeSingle(),
    ]);

    const buyerRole = buyerProfile?.role || "standard";
    const sellerRole = sellerProfile?.role || "standard";

    const buyerRates = getFeeRatesForRole(buyerRole);
    const sellerRates = getFeeRatesForRole(sellerRole);

    const fees = calcFees({
      basePrice: ticket.price,
      buyerRate: buyerRates.buyerRate,
      sellerRate: sellerRates.sellerRate,
    });

    return NextResponse.json({
      ticket,
      event,
      roles: { buyerRole, sellerRole },
      fees,
    });
  } catch (e) {
    console.error("checkout/preview error:", e);
    return NextResponse.json(
      { error: e?.message || "Error interno." },
      { status: 500 }
    );
  }
}
