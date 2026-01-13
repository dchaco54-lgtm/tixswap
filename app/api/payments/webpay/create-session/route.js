import { NextResponse } from 'next/server';
import crypto from 'crypto';

import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getWebpayTransaction } from '@/lib/webpay';
// NOTA: Evitamos depender de helpers externos (ej: getFees) porque en prod puede quedar
// desfasado con el repo (y explota con "... is not a function"). Calculamos el fee acá.

function normalizeBaseUrl(url) {
  if (!url) return '';
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

/**
 * Fee comprador: 2.5% con mínimo $1.200 (CLP)
 * Retorna { feeAmount, totalAmount }
 */
function calcPlatformFee(amount) {
  const a = Math.round(Number(amount) || 0);
  const pct = Math.round(a * 0.025);
  const feeAmount = Math.max(pct, 1200);
  return { feeAmount, totalAmount: a + feeAmount };
}

export async function POST(req) {
  try {
    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // Validar token del usuario en Supabase
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !userData?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    const userId = userData.user.id;

    const body = await req.json();
    const { ticketId, buyerId } = body || {};

    if (!ticketId || !buyerId) {
      return NextResponse.json({ error: 'Faltan datos' }, { status: 400 });
    }

    // Seguridad básica: buyerId debe coincidir con el user logeado
    if (buyerId !== userId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const admin = supabaseAdmin;

    // 1) Buscar ticket + validar estado
    const { data: ticket, error: ticketError } = await admin
      .from('tickets')
      .select('id, price, status, event_id, seller_id')
      .eq('id', ticketId)
      .single();

    if (ticketError || !ticket) {
      return NextResponse.json({ error: 'Ticket no encontrado' }, { status: 404 });
    }

    if (ticket.status !== 'active') {
      return NextResponse.json({ error: 'Ticket no disponible' }, { status: 409 });
    }

    // 2) Bloquear ticket (hold) para evitar doble compra
    const { error: holdError } = await admin
      .from('tickets')
      .update({ status: 'held' })
      .eq('id', ticketId)
      .eq('status', 'active');

    if (holdError) {
      return NextResponse.json({ error: 'No se pudo reservar el ticket' }, { status: 409 });
    }

    // Fees (2.5% con mínimo $1.200)
    const amount = Number(ticket.price);
    const { feeAmount, totalAmount } = calcPlatformFee(amount);

    // Crear buyOrder y sessionId (Webpay)
    const buyOrder = `TS-${ticketId.slice(0, 8)}-${Date.now()}`;
    const sessionId = crypto.randomUUID();

    // Crear orden en BD
    const { data: order, error: orderError } = await admin
      .from('orders')
      .insert({
        ticket_id: ticketId,
        buyer_id: buyerId,
        seller_id: ticket.seller_id,
        event_id: ticket.event_id,
        ticket_price: amount,
        platform_fee: feeAmount,
        total_amount: totalAmount,
        payment_provider: 'webpay',
        payment_state: 'initiated',
        payment_status: 'pending',
        buy_order: buyOrder,
        session_id: sessionId,
      })
      .select('id')
      .single();

    if (orderError || !order) {
      // rollback hold
      await admin.from('tickets').update({ status: 'active' }).eq('id', ticketId).eq('status', 'held');
      return NextResponse.json({ error: 'No se pudo crear la orden' }, { status: 500 });
    }

    // 3) Crear sesión en Webpay
    const baseUrl = normalizeBaseUrl(process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin);
    const returnUrl = `${baseUrl}/api/payments/webpay/return`;

    let result;
    try {
      const transaction = getWebpayTransaction();
      result = await transaction.create(buyOrder, sessionId, totalAmount, returnUrl);
    } catch (e) {
      // rollback hold + orden
      await admin.from('tickets').update({ status: 'active' }).eq('id', ticketId).eq('status', 'held');
      await admin.from('orders').update({ payment_state: 'failed', payment_status: 'failed' }).eq('id', order.id);
      throw e;
    }

    // 4) Persistir token/url en la orden
    await admin
      .from('orders')
      .update({
        webpay_token: result.token,
        payment_process_url: result.url,
        payment_state: 'session_created',
      })
      .eq('id', order.id);

    return NextResponse.json({ token: result.token, url: result.url }, { status: 200 });
  } catch (err) {
    console.error('Webpay create-session error:', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
