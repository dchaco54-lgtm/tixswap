import { NextResponse } from 'next/server';
import crypto from 'crypto';

import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getWebpayTransaction } from '@/lib/webpay';
import { getFees } from '@/lib/fees';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Webpay: buyOrder máx 26 chars. Mantengámoslo corto y simple.
function makeBuyOrder() {
  // Ej: TS + base36(timestamp) + base36(random)
  const ts = Date.now().toString(36);
  const rnd = Math.floor(Math.random() * 1e6).toString(36);
  return (`TS${ts}${rnd}`).toUpperCase().slice(0, 26);
}

function makeSessionId() {
  const raw = crypto.randomUUID().replace(/-/g, '');
  return `S${raw.slice(0, 20)}`; // <= 21 chars
}

function normalizeBaseUrl(url) {
  if (!url) return '';
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

export async function POST(req) {
  try {
    const body = await req.json();
    const { ticketId, buyerId } = body || {};

    if (!ticketId) {
      return NextResponse.json({ error: 'ticketId requerido' }, { status: 400 });
    }

    // Usuario logueado (token desde el cliente)
    // OJO: este proyecto usa supabase-js en el browser (localStorage), no cookies.
    // Por eso acá validamos con Authorization: Bearer <access_token>
    const admin = supabaseAdmin();
    const authHeader = req.headers.get('authorization') || '';
    const accessToken = authHeader.startsWith('Bearer ')
      ? authHeader.slice('Bearer '.length).trim()
      : null;

    if (!accessToken) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { data: userData, error: userError } = await admin.auth.getUser(accessToken);
    const user = userData?.user;
    if (userError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // Defensa extra: si el frontend envía buyerId, debe coincidir
    if (buyerId && buyerId !== user.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

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

    // Fees (2.5% con mínimo $1.200)
    const amount = Number(ticket.price);
    const { feeAmount, totalAmount } = getFees(amount, {
      buyerRate: 0.025,
      buyerMin: 1200,
    });

    const buyOrder = makeBuyOrder();
    const sessionId = makeSessionId();

    // 1) Reservar ticket (race-safe)
    // Nota: en PostgREST un UPDATE que afecta 0 filas NO lanza error, por eso validamos el retorno.
    const { data: heldRows, error: holdError } = await admin
      .from('tickets')
      .update({ status: 'held' })
      .eq('id', ticketId)
      .eq('status', 'active')
      .select('id');

    if (holdError || !heldRows || heldRows.length === 0) {
      return NextResponse.json(
        { error: 'No se pudo reservar el ticket (puede que ya lo hayan tomado)' },
        { status: 409 }
      );
    }

    // 2) Crear orden
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
