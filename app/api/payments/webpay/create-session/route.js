import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';

import { getWebpayTransaction } from '@/lib/webpay';
import { calculateFees } from '@/lib/fees';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

async function insertOrderWithFallback(sb, orderData) {
  let payload = { ...orderData };
  const required = new Set(['ticket_id', 'buyer_id', 'seller_id', 'status', 'buy_order', 'session_id']);

  // Try to gracefully handle schema mismatches by removing unknown columns.
  // This helps when the DB schema is evolving across deployments.
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const { error } = await sb.from('orders').insert(payload);
    if (!error) return { ok: true };

    const msg = String(error.message || '');
    // Postgres error format: column "X" of relation "orders" does not exist
    let m = msg.match(/column\s+"([^"]+)"\s+of\s+relation\s+"orders"\s+does\s+not\s+exist/i);
    if (!m) {
      // PostgREST schema cache format: Could not find the 'X' column of 'orders' in the schema cache
      m = msg.match(/Could not find the '([^']+)' column of 'orders'/i);
    }

    const missingColumn = m?.[1];
    if (missingColumn && Object.prototype.hasOwnProperty.call(payload, missingColumn)) {
      // If the DB is missing a required column, the integration cannot work.
      if (required.has(missingColumn)) {
        return { ok: false, error };
      }

      delete payload[missingColumn];
      continue;
    }

    return { ok: false, error };
  }

  return { ok: false, error: { message: 'No se pudo crear la orden (schema mismatch)' } };
}

function jsonError(message, status = 400, extra = {}) {
  // Never leak secrets. Keep responses clean for the UI.
  return NextResponse.json({ error: message, ...extra }, { status });
}

function getBaseUrl(req) {
  const origin = req.headers.get('origin');
  const fromEnv =
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined);
  return origin || fromEnv || 'http://localhost:3000';
}

function toInt(value, fallback = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.round(n);
}

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const ticketId = body?.ticketId;
    const buyerId = body?.buyerId;

    if (!ticketId) return jsonError('ticketId es requerido', 400);
    if (!buyerId) return jsonError('buyerId es requerido', 400);

    // Admin client (service role). This file uses lib/supabaseAdmin which supports
    // multiple env var names (SUPABASE_URL, NEXT_PUBLIC_SUPABASE_URL, etc.).
    let sb;
    try {
      sb = supabaseAdmin();
    } catch (e) {
      return jsonError(
        'Falta configurar Supabase (service role) en el servidor. Revisa SUPABASE_SERVICE_ROLE_KEY / SUPABASE_SERVICE_KEY.',
        500
      );
    }

    // 1) Fetch ticket (must be active)
    const { data: ticket, error: ticketErr } = await sb
      .from('tickets')
      .select('id, price, price_clp, status, seller_id')
      .eq('id', ticketId)
      .single();

    if (ticketErr) return jsonError(`Error al obtener ticket: ${ticketErr.message}`, 500);
    if (!ticket) return jsonError('Ticket no encontrado', 404);

    if (ticket.status !== 'active') {
      return jsonError('Este ticket ya no está disponible.', 409);
    }

    const price = toInt(ticket.price ?? ticket.price_clp, 0);
    if (price <= 0) return jsonError('El precio del ticket es inválido', 400);

    // 2) Compute fees (buyer pays total)
    const { platformFee, total } = calculateFees(price);
    const amountToPay = toInt(total, price);

    // 3) Create order / hold ticket
    const buyOrder = randomUUID().replace(/-/g, '').slice(0, 26);
    const sessionId = buyerId; // keep it simple for now

    // Hold for 10 minutes
    const holdExpiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    const { error: holdErr } = await sb
      .from('tickets')
      .update({ status: 'held', hold_expires_at: holdExpiresAt })
      .eq('id', ticketId)
      .eq('status', 'active');

    if (holdErr) return jsonError(`No se pudo reservar el ticket: ${holdErr.message}`, 500);

    // Create order row (used later by /api/payments/webpay/return)
    // Keep this payload minimal to avoid breaking if your DB schema changes.
    // (You can add more columns later, once confirmed in Supabase.)
    const orderData = {
      ticket_id: ticketId,
      buyer_id: buyerId,
      seller_id: ticket.seller_id,
      status: 'pending',
      buy_order: buyOrder,
      session_id: sessionId,
      total_amount: amountToPay, // older schema compatibility
      total_clp: amountToPay, // newer schema compatibility
      payment_provider: 'webpay',
    };

    const insertRes = await insertOrderWithFallback(sb, orderData);
    if (!insertRes.ok) {
      // revert hold
      await sb.from('tickets').update({ status: 'active', hold_expires_at: null }).eq('id', ticketId);
      return jsonError(`No se pudo crear la orden: ${insertRes.error?.message || 'Error desconocido'}`, 500);
    }

    // 4) Create Webpay session (Integration)
    const tx = getWebpayTransaction();
    const baseUrl = getBaseUrl(req);
    const returnUrl = `${baseUrl}/api/payments/webpay/return`;

    let createResult;
    try {
      createResult = await tx.create(buyOrder, sessionId, amountToPay, returnUrl);
    } catch (e) {
      // revert hold + order
      await sb.from('orders').delete().eq('buy_order', buyOrder);
      await sb.from('tickets').update({ status: 'active', hold_expires_at: null }).eq('id', ticketId);
      return jsonError(`Webpay: no se pudo iniciar la transacción (${e?.message || 'error'}).`, 502);
    }

    const token = createResult?.token;
    const url = createResult?.url;
    if (!token || !url) {
      await sb.from('orders').delete().eq('buy_order', buyOrder);
      await sb.from('tickets').update({ status: 'active', hold_expires_at: null }).eq('id', ticketId);
      return jsonError('Webpay: respuesta inválida al crear la transacción.', 502);
    }

    // Store token for later lookups
    await sb.from('orders').update({ token_ws: token }).eq('buy_order', buyOrder);

    return NextResponse.json({ token, url });
  } catch (err) {
    console.error('[webpay/create-session] Unhandled error:', err);
    return jsonError('Error interno al iniciar el pago.', 500);
  }
}
