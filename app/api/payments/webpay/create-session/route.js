import { NextResponse } from 'next/server';
import crypto from 'crypto';

import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getWebpayPlusTransaction } from '@/lib/webpay';
import { calculateFees } from '@/lib/fees';

function safeJsonParse(str) {
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}

export async function POST(req) {
  try {
    const body = await req.json();
    const { ticketId, buyerId } = body || {};

    if (!ticketId) {
      return NextResponse.json({ error: 'ticketId es requerido' }, { status: 400 });
    }

    // Autenticación via Bearer token (porque tu sesión está en localStorage, no cookies)
    const admin = supabaseAdmin();
    const authHeader = req.headers.get('authorization') || '';
    const accessToken = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : null;

    if (!accessToken) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { data: userData, error: userError } = await admin.auth.getUser(accessToken);
    const user = userData?.user;

    if (userError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // Si el frontend manda buyerId, lo validamos (anti-spoof)
    if (buyerId && buyerId !== user.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // 1) Traer ticket + evento
    const { data: ticket, error: ticketError } = await admin
      .from('tickets')
      .select(
        `
        id, status, price, seller_id, event_id,
        events:event_id ( id, title, starts_at )
      `
      )
      .eq('id', ticketId)
      .single();

    if (ticketError || !ticket) {
      return NextResponse.json({ error: 'Ticket no encontrado' }, { status: 404 });
    }

    if (ticket.status !== 'active') {
      return NextResponse.json({ error: 'Ticket no disponible' }, { status: 409 });
    }

    const event = ticket.events;
    const ticketPrice = Number(ticket.price || 0);

    // 2) Calcular fees
    const fees = calculateFees(ticketPrice);
    const amount = Math.round(fees.totalDue);

    // 3) Crear orderId
    const orderId = crypto.randomUUID();

    // 4) Reservar ticket (race-safe) y crear orden
    // 4.1: HOLD ticket (solo si aún está active)
    const { data: heldRows, error: holdError } = await admin
      .from('tickets')
      .update({ status: 'held' })
      .eq('id', ticketId)
      .eq('status', 'active')
      .select('id');

    if (holdError || !heldRows?.length) {
      return NextResponse.json({ error: 'No se pudo reservar el ticket' }, { status: 409 });
    }

    // 4.2: Crear orden
    const { error: orderError } = await admin.from('orders').insert({
      id: orderId,
      ticket_id: ticketId,
      buyer_id: user.id,
      seller_id: ticket.seller_id,
      amount,
      platform_fee: Math.round(fees.platformFee),
      status: 'pending',
      payment_method: 'webpay',
    });

    if (orderError) {
      // rollback hold
      await admin.from('tickets').update({ status: 'active' }).eq('id', ticketId).eq('status', 'held');
      return NextResponse.json({ error: 'No se pudo crear la orden' }, { status: 500 });
    }

    // 5) Iniciar Webpay
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') || '';
    const returnUrl = `${baseUrl}/api/payments/webpay/return?orderId=${orderId}`;

    const buyOrder = orderId;
    const sessionId = user.id;

    try {
      const webpay = getWebpayPlusTransaction();
      const response = await webpay.create(buyOrder, sessionId, amount, returnUrl);

      const token = response?.token;
      const url = response?.url;

      if (!token || !url) {
        throw new Error('Respuesta inválida de Webpay');
      }

      await admin
        .from('orders')
        .update({
          payment_provider: 'webpay',
          payment_token: token,
          payment_status: 'initiated',
        })
        .eq('id', orderId);

      return NextResponse.json({ token, url, orderId });
    } catch (e) {
      // Rollback: marcar orden como failed y liberar ticket
      const msg = typeof e?.message === 'string' ? e.message : 'Error Webpay';

      await admin
        .from('orders')
        .update({
          payment_state: 'failed',
          payment_status: 'failed',
          error_message: msg,
        })
        .eq('id', orderId);

      await admin.from('tickets').update({ status: 'active' }).eq('id', ticketId).eq('status', 'held');

      return NextResponse.json({ error: msg }, { status: 500 });
    }
  } catch (e) {
    const msg = typeof e?.message === 'string' ? e.message : 'Error interno';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
