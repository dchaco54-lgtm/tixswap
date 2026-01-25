// lib/trustSignals.js
import { supabaseAdmin } from "./supabaseAdmin";

function pickFirst(...vals) {
  return vals.find((v) => typeof v === "string" && v.trim().length > 0) || null;
}

function safeSellerName(profile, sellerId) {
  // NUNCA usar email para nombre público
  const name = pickFirst(
    profile?.display_name,
    profile?.full_name,
    profile?.name,
    profile?.username,
    profile?.handle
  );
  if (name) return name;
  return sellerId ? `Vendedor ${String(sellerId).slice(0, 6)}` : "Vendedor";
}

export async function getBulkSellerTrustSignals(sellerIds = []) {
  const unique = [...new Set((sellerIds || []).filter(Boolean))];
  if (unique.length === 0) return {};

  // 1) Perfiles (con service role), pero SOLO usamos campos seguros
  const { data: profiles, error: profErr } = await supabaseAdmin
    .from("profiles")
    .select("*")
    .in("id", unique);

  if (profErr) {
    console.error("trustSignals: profiles error", profErr);
  }

  const profileMap = new Map();
  (profiles || []).forEach((p) => profileMap.set(p.id, p));

  // 2) Stats (si no existen tablas, devolvemos defaults)
  // Nota: acá puedes enchufar reviews/ventas reales más adelante.
  const out = {};
  for (const id of unique) {
    const p = profileMap.get(id);

    out[id] = {
      sellerId: id,
      sellerName: safeSellerName(p, id),
      avatarUrl: pickFirst(p?.avatar_url, p?.avatar, p?.photo_url),

      // señales “soft” (ajusta cuando tengas data real)
      salesCount: Number(p?.sales_count || 0),
      disputesCount: Number(p?.disputes_count || 0),
      fulfillmentRate: Number(p?.fulfillment_rate || 0),

      // verificaciones (si existen columnas)
      emailVerified: Boolean(p?.email_verified),
      phoneVerified: Boolean(p?.phone_verified),
      walletVerified: Boolean(p?.wallet_verified),
    };
  }

  return out;
}

