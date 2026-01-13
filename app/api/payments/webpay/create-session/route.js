import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { getWebpayTransaction } from '@/lib/webpay';

// Fuerza runtime Node (Transbank SDK usa Node APIs)
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

function getBaseUrl() {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, '');

  const vercelUrl = process.env.VERCEL_URL;
  if (vercelUrl) return `https://${vercelUrl}`;

  return 'http://localhost:3000';
}

function jsonError(message, details, status = 500) {
  return new NextResponse(JSON.stringify({ error: message, details }), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

// Comisión TixSwap: 2.5% con mínimo $1.200
function calcFeeCLP(subtotalCLP) {
  const pct = Math.round(subtotalCLP * 0.025);
  return Math.max(pct, 1200);
}

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const { ticketId, buyerId } = body || {};

    if (!ticketId || !buyerId) {
      return jsonError('Solicitud inválida', 'Faltan ticketId o buyerId', 400);
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return jsonError(
        'Configuración faltante',
        'NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY no configurados',
        500
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // 1) Obtener ticket
    const { data: ticket, error: ticketErr } = await supabase
      .from('tickets')
      .select('id,status,price,event_id,seller_id')
      .eq('id', ticketId)
      .single();

    if (ticketErr) return jsonError('No se pudo obtener ticket', ticketErr.message, 500);
    if (!ticket) return jsonError('Ticket no encontrado', 'No existe ticket con ese id', 404);

    // Solo se puede comprar si está activo
    if (ticket.status !== 'active') {
      return jsonError('Ticket no disponible', `Estado actual: ${ticket.status}`, 409);
    }

    // 2) Marcar ticket como "held" (reservado) antes de iniciar Webpay
    const { error: holdErr } = await supabase
      .from('tickets')
      .update({ status: 'held' })
      .eq('id', ticketId)
      .eq('status', 'active');

    if (holdErr) return jsonError('No se pudo reservar el ticket', holdErr.message, 500);

    // 3) Crear Order en BD (columnas reales del esquema actual)
    const subtotal = Number(ticket.price || 0);
    const fee = calcFeeCLP(subtotal);
    const total = subtotal + fee;

    // Webpay: buy_order máx 26 chars
    const buyOrder = randomUUID().replace(/-/g, '').slice(0, 26);
    const sessionId = randomUUID();

    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .insert({
        buyer_id: buyerId,
        seller_id: ticket.seller_id,
        event_id: ticket.event_id,
        ticket_id: ticket.id,

        amount: subtotal,
        amount_clp: subtotal,
        fee_clp: fee,
        total_amount: total,
        total_clp: total,

        currency: 'CLP',
        status: 'created',
        payment_state: 'pending',
        payment_method: 'webpay',

        payment_request_id: buyOrder,
      })
      .select('*')
      .single();

    if (orderErr) {
      // rollback: devuelve ticket a active si falló crear orden
      await supabase.from('tickets').update({ status: 'active' }).eq('id', ticketId);
      return jsonError('No se pudo crear la orden', orderErr.message, 500);
    }

    // 4) Crear transacción Webpay
    const baseUrl = getBaseUrl();
    const returnUrl = `${baseUrl}/api/payments/webpay/return?orderId=${order.id}`;

    const tx = getWebpayTransaction();

    let createResult;
    try {
      createResult = await Promise.race([
        tx.create(buyOrder, sessionId, total, returnUrl),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Timeout al crear transacción Webpay')), 20000)
        ),
      ]);
    } catch (err) {
      await supabase
        .from('orders')
        .update({
          status: 'failed',
          payment_state: 'failed',
          payment_payload: { error: String(err?.message || err) },
        })
        .eq('id', order.id);

      await supabase.from('tickets').update({ status: 'active' }).eq('id', ticketId);

      return jsonError('Error al iniciar Webpay', err?.message || String(err), 502);
    }

    // 5) Guardar datos de Webpay en la orden
    const { error: updErr } = await supabase
      .from('orders')
      .update({
        payment_provider: 'webpay',
        payment_state: 'initiated',
        status: 'initiated',
        webpay_token: createResult?.token,
        payment_process_url: createResult?.url,
        payment_payload: createResult,
      })
      .eq('id', order.id);

    if (updErr) {
      console.error('Order update after webpay create failed:', updErr);
    }

    return NextResponse.json({
      orderId: order.id,
      url: createResult.url,
      token: createResult.token,
    });
  } catch (err) {
    console.error('create-session fatal:', err);
    return jsonError('Error interno', err?.message || String(err), 500);
  }
}
