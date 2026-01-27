import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function getEnv(name) {
  const v = process.env[name];
  return v && String(v).trim().length ? String(v).trim() : null;
}

function json(data, status = 200) {
  return NextResponse.json(data, { status });
}

function toNumber(n) {
  const x = Number(n);
  return Number.isFinite(x) ? x : 0;
}

function normalizeTicket(ticket) {
  return {
    id: ticket?.id,
    status: ticket?.status || null,
    event_id: ticket?.event_id || null,
    seller_id: ticket?.seller_id || ticket?.owner_id || ticket?.user_id || null,

    // Fallbacks para mostrar vendedor en checkout aunque el perfil (profiles)
    // esté incompleto. En tu tabla tickets estos campos ya vienen (seller_name/email/rut).
    seller_name: ticket?.seller_name || ticket?.sellerName || null,
    seller_email: ticket?.seller_email || ticket?.sellerEmail || null,
    seller_rut: ticket?.seller_rut || ticket?.sellerRut || null,

    price: toNumber(ticket?.price),
    original_price: toNumber(ticket?.original_price),
    platform_fee: toNumber(ticket?.platform_fee),
    currency: ticket?.currency || "CLP",
    sector: ticket?.sector || null,
    row_label: ticket?.row_label || null,
    seat_label: ticket?.seat_label || null,
    section_label: ticket?.section_label || null,
    sale_type: ticket?.sale_type || "fixed",
    title: ticket?.title || null,
    description: ticket?.description || null,
  };
}

function normalizeEvent(event) {
  return {
    id: event?.id,
    name: event?.name || null,
    venue: event?.venue || null,
    city: event?.city || null,
    country: event?.country || null,
    starts_at: event?.starts_at || null,
    image_url: event?.image_url || null,
  };
}

function normalizeSeller(profile) {
  if (!profile) return null;
  return {
    id: profile?.id || null,
    full_name: profile?.full_name || profile?.name || null,
    email: profile?.email || null,
    avatar_url: profile?.avatar_url || null,
    phone: profile?.phone || null,
    rut: profile?.rut || null,
  };
}

async function getProfileSafe(userId) {
  const supabaseUrl = getEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) return null;

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  // detect columns existence
  const { data: cols, error: colsErr } = await admin
    .from("information_schema.columns")
    .select("column_name")
    .eq("table_schema", "public")
    .eq("table_name", "profiles");

  const colset = new Set((cols || []).map((c) => c.column_name));
  if (colsErr) {
    // if cannot read info_schema, fallback to basic select
    const { data } = await admin.from("profiles").select("id").eq("id", userId).maybeSingle();
    return data || null;
  }

  const want = ["id", "full_name", "name", "email", "avatar_url", "phone", "rut"].filter((c) =>
    colset.has(c)
  );
  const selectStr = want.length ? want.join(",") : "id";

  const { data, error } = await admin.from("profiles").select(selectStr).eq("id", userId).maybeSingle();
  if (error) return null;
  return data || null;
}

async function getSellerRatingsSafe(sellerId) {
  const supabaseUrl = getEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) return null;

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  // ratings table might not exist
  const { data: cols, error: colsErr } = await admin
    .from("information_schema.tables")
    .select("table_name")
    .eq("table_schema", "public")
    .eq("table_name", "seller_ratings")
    .maybeSingle();

  if (colsErr || !cols) return null;

  const { data, error } = await admin
    .from("seller_ratings")
    .select("rating")
    .eq("seller_id", sellerId);

  if (error) return null;
  const arr = data || [];
  const count = arr.length;
  const avg = count ? arr.reduce((s, r) => s + toNumber(r.rating), 0) / count : 0;
  return { count, avg: Math.round(avg * 10) / 10 };
}

export async function GET(req) {
  try {
    const supabaseUrl = getEnv("NEXT_PUBLIC_SUPABASE_URL");
    const serviceKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl) return json({ error: "Missing NEXT_PUBLIC_SUPABASE_URL" }, 500);
    if (!serviceKey) return json({ error: "Missing SUPABASE_SERVICE_ROLE_KEY" }, 500);

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    const url = new URL(req.url);
    const ticketId = url.searchParams.get("ticketId");
    if (!ticketId) return json({ error: "Missing ticketId" }, 400);

    const { data: ticketRow, error: ticketErr } = await admin.from("tickets").select("*").eq("id", ticketId).maybeSingle();
    if (ticketErr) return json({ error: "DB ticket read failed", details: ticketErr.message }, 500);
    if (!ticketRow) return json({ error: "Ticket not found" }, 404);

    const ticketNorm = normalizeTicket(ticketRow);

    let eventNorm = null;
    if (ticketNorm.event_id) {
      const { data: eventRow } = await admin.from("events").select("*").eq("id", ticketNorm.event_id).maybeSingle();
      eventNorm = normalizeEvent(eventRow);
    }

    const sellerId = ticketNorm.seller_id;
    const sellerProfile = sellerId ? await getProfileSafe(sellerId) : null;

    const sellerFromProfile = normalizeSeller(sellerProfile);

    // Merge defensivo: si el perfil no tiene nombre/mail/rut, usamos lo que
    // ya trae la tabla tickets (seller_name/seller_email/seller_rut)
    const seller = {
      id: sellerId || sellerFromProfile?.id || null,
      full_name: sellerFromProfile?.full_name || ticketNorm.seller_name || null,
      email: sellerFromProfile?.email || ticketNorm.seller_email || null,
      rut: sellerFromProfile?.rut || ticketNorm.seller_rut || null,
      avatar_url: sellerFromProfile?.avatar_url || null,
      phone: sellerFromProfile?.phone || null,
    };

    const ratings = sellerId ? await getSellerRatingsSafe(sellerId) : null;

    const price = ticketNorm.price;
    const platformFee = ticketNorm.platform_fee;
    const total = price + platformFee;

    return json({
      ok: true,
      ticket: {
        ...ticketNorm,
        priceToPay: total,
      },
      event: eventNorm,
      seller,
      ratings: ratings || { count: 0, avg: 0 },
      fees: { platform_fee: platformFee },
    });
  } catch (e) {
    return json({ error: "Unexpected error", details: e?.message || String(e) }, 500);
  }
}

