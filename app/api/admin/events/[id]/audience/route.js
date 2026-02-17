import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getUserFromBearer, isAdminUser } from "@/lib/support/auth";
import { getEventAudience } from "@/lib/events/audience";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function normalizeAdminEmails() {
  return String(process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((email) => String(email || "").trim().toLowerCase())
    .filter(Boolean);
}

async function ensureAdmin(req, admin) {
  const { user, error } = await getUserFromBearer(req, admin);
  if (!user || error) return { ok: false, error: "UNAUTHORIZED" };

  const { ok } = await isAdminUser(admin, user);
  if (ok) return { ok: true, user };

  const email = String(user.email || "").toLowerCase().trim();
  const allowlist = new Set(normalizeAdminEmails());
  if (email && allowlist.has(email)) return { ok: true, user };

  return { ok: false, error: "FORBIDDEN" };
}

export async function GET(req, { params }) {
  try {
    const eventId = params?.id;
    if (!eventId) {
      return NextResponse.json({ error: "Evento inválido" }, { status: 400 });
    }

    const admin = supabaseAdmin();
    const auth = await ensureAdmin(req, admin);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.error === "FORBIDDEN" ? 403 : 401 });
    }

    const url = new URL(req.url);
    const includeSellers = url.searchParams.get("includeSellers") === "true";
    const includeBuyers = url.searchParams.get("includeBuyers") !== "false";
    const includeSubscribers = url.searchParams.get("includeSubscribers") !== "false";

    const audience = await getEventAudience(admin, eventId, { includeSellers });
    const totalSelected = new Set();
    if (includeBuyers) audience.buyers.forEach((id) => totalSelected.add(id));
    if (includeSubscribers) audience.subscribers.forEach((id) => totalSelected.add(id));
    if (includeSellers) audience.sellers.forEach((id) => totalSelected.add(id));

    return NextResponse.json({
      buyersCount: audience.buyersCount,
      subscribersCount: audience.subscribersCount,
      sellersCount: audience.sellersCount,
      totalUniqueCount: totalSelected.size,
    });
  } catch (err) {
    console.error("[admin/events/audience] error:", err);
    return NextResponse.json({ error: "No pudimos calcular audiencia" }, { status: 500 });
  }
}
