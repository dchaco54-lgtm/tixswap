import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { getFees } from "@/lib/fees";

function parseCLP(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (value == null) return 0;
  const digits = String(value).replace(/[^0-9]/g, "");
  const n = Number(digits);
  return Number.isFinite(n) ? n : 0;
}

function pickFirst(...vals) {
  for (const v of vals) if (v !== undefined && v !== null && v !== "") return v;
  return null;
}

function isBuyableStatus(status) {
  const s = String(status || "").toLowerCase().trim();
  if (!s) return true;
  return ["available", "published", "active", "listed"].includes(s);
}

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const ticketId = body?.ticketId;
    const returnUrl = body?.returnUrl;

    if (!ticketId) return NextResponse.json({ error: "ticketId requerido" }, { status: 400 });

    const supabase = createRouteHandlerClient({ cookies });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { data: ticket } = await supabase
      .from("tickets")
      .select("*")
      .eq("id", ticketId)
      .maybeSingle();

    if (!ticket) return NextResponse.json({ error: "Ticket no encontrado" }, { status: 404 });
    if (!isBuyableStatus(ticket.status))
      return NextResponse.json({ error: "Ticket no disponible" }, { status: 409 });

    const priceRaw = pickFirst(ticket.price, ticket.value, ticket.amount, ticket.price_clp);
    const ticketPrice = parseCLP(priceRaw);

    const { data: sellerProfile } = await supabase
      .from("profiles")
      .select("seller_tier")
      .eq("id", ticket.seller_id)
      .maybeSingle();

    const fees = getFees(ticketPrice, { sellerTier: sellerProfile?.seller_tier });

    // ✅ Aquí va la integración REAL con Banco de Chile cuando tengas credenciales.
    // Por ahora: flujo SIMULADO.
    const origin = new URL(req.url).origin;
    const finalReturnUrl = returnUrl || `${origin}/checkout/${ticketId}`;

    const token = `sim_banchile_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const processUrl = `${origin}/pago-simulado/banco-chile?ticketId=${encodeURIComponent(
      ticketId
    )}&amount=${encodeURIComponent(fees.totalDue)}&returnUrl=${encodeURIComponent(
      finalReturnUrl
    )}&token=${encodeURIComponent(token)}`;

    return NextResponse.json({ token, processUrl, amount: fees.totalDue });
  } catch (e) {
    return NextResponse.json({ error: "Error creando sesión Banco de Chile" }, { status: 500 });
  }
}



