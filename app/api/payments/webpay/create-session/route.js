import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import crypto from 'crypto';

import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getWebpayTransaction } from '@/lib/webpay';
import { getFees } from '@/lib/fees';

// Webpay: buyOrder máx 26 chars. Session id también conviene corto.
function makeBuyOrder() {
  // TS + timestamp(ms) + random(0-999999) => ~21 chars
  const rand = Math.floor(Math.random() * 1_000_000)
    .toString()
    .padStart(6, '0');
  return `TS${Date.now()}${rand}`.slice(0, 26);
}

function makeSessionId() {
  return `S${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}`; // 21 chars
}

function normalizeBaseUrl(url) {
  if (!url) return '';
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

export async function POST(req) {
  try {
    const body = await req.json();
    const { ticketId } = body || {};

    if (!ticketId) {
      return NextResponse.json({ error: 'ticketId requerido' }, { status: 400 });
    }

    // Usuario logueado (igual que Banchile)
    const supabase = createRouteHandlerClient({ cookies });
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const user = userData.user;
    const admin = supabaseAdmin();

    // Ticket
    const { data: ticket, error: ticketError } = await admin
      .from('tickets')
      .select('id, status, price, seller_id')
      .eq('id', ticketId)
      .single();

    if (ticketError || !ticket) {
      return NextResponse.json({ error: 'Ticket no encontrado' }, { status: 404 });
    }

    if (ticket.status !== 'active') {
      return NextResponse.json({ error: 'Ticket no disponible' }, { status: 409 });
    }

    if (ticket.seller_id === user.id) {
      return NextResponse.json({ error: 'No puedes comprar tu propio ticket' }, { status: 400 });
    }

    const amount = Number(ticket.price);

    // Fee fijo: 2.5% con mínimo $1.200 (lo que pediste)
    const { feeAmount, totalAmount } = getFees(amount, {
      buyerRate: 0.025,
      buyerMin: 1200,
    });

    const buyOrder = makeBuyOrder();
    const sessionId = makeSessionId();

    // Reservar el ticket (anti carrera)
    const { error: holdError } = await admin
      .from('tickets')
      .update({ status: 'held' })
      .eq('id', ticketId)
      .eq('status', 'active');

    if (holdError) {
      return NextResponse.json({ error: 'No se pudo reservar el ticket' }, { status: 409 });
    }

    // Crear orden en BD (columnas reales según tu inventario)
    const { data: order, error: orderError } = await admin
      .from('orders')
      .insert({
        ticket_id: ticketId,
        user_id: user.id, // comprador
        seller_id: ticket.seller_id,
        buy_order: buyOrder,
        session_id: sessionId,
        amount,
        fee: feeAmount,
        total_amount: totalAmount,
        payment_state: 'created',
        payment_status: 'pending',
      })
      .select('id')
      .single();

    if (orderError || !order) {
      // rollback hold
      await admin
        .from('tickets')
        .update({ status: 'active' })
        .eq('id', ticketId)
        .eq('status', 'held');

      return NextResponse.json({ error: 'No se pudo crear la orden' }, { status: 500 });
    }

    const baseUrl = normalizeBaseUrl(process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin);
    const returnUrl = `${baseUrl}/api/payments/webpay/return`;

    // Crear sesión Webpay
    const transaction = getWebpayTransaction();
    const result = await transaction.create(buyOrder, sessionId, totalAmount, returnUrl);

    // Guardar token/url en orden
    await admin
      .from('orders')
      .update({
        webpay_token: result.token,
        payment_process_url: result.url,
        payment_state: 'session_created',
      })
      .eq('id', order.id);

    return NextResponse.json({ token: result.token, url: result.url });
  } catch (err) {
    console.error('Webpay create-session error:', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
