import { NextResponse } from 'next/server';
import crypto from 'crypto';

import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getWebpayTransaction } from '@/lib/webpay';
// NOTA: Evitamos depender de helpers externos (ej: getFees) porque en prod puede quedar
// desfasado con el repo (y explota con "... is not a function"). Calculamos el fee acá.

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

function calcPlatformFee(ticketPrice) {
  const price = Math.round(Number(ticketPrice) || 0);
  // Fee por plataforma: 2.5% con mínimo $1.200 (ajusta si tu negocio cambia esta regla)
  const pct = Math.round(price * 0.025);
  const fee = Math.max(pct, 1200);
  return { feeAmount: fee, totalAmount: price + fee };
}

// Fallback para validar el access_token sin depender de admin.auth (en algunos builds queda undefined)
async function getUserViaSupabaseRest(accessToken) {
  try {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const apiKey =
      process.env.SUPABASE_ANON_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !apiKey || !accessToken) return null;

    const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        apikey: apiKey,
        Authorization: `Bearer ${accessToken}`,
      },
      // Importante: evita cache raro en serverless
      cache: 'no-store',
    });

    if (!res.ok) return null;
    const user = await res.json().catch(() => null);
    return user && user.id ? user : null;
  } catch {
    return null;
  }
}


export async function POST(req) {
  try {
    console.log('[Webpay] === INICIO create-session ===');
    const body = await req.json();
    const { ticketId, buyerId } = body || {};

    console.log('[Webpay] Body recibido:', { ticketId, buyerId });

    if (!ticketId) {
      console.log('[Webpay] Error: ticketId faltante');
      return NextResponse.json({ error: 'ticketId requerido' }, { status: 400 });
    }

    // Usuario logueado (token desde el cliente)
    const admin = supabaseAdmin();
    const authHeader = req.headers.get('authorization') || '';
    const accessToken = authHeader.startsWith('Bearer ')
      ? authHeader.slice('Bearer '.length).trim()
      : null;

    console.log('[Webpay] Token presente:', !!accessToken);

    if (!accessToken) {
      console.log('[Webpay] Error: No hay token');
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    let user = null;

    // Intento 1: supabase-js (service role)
    if (admin?.auth?.getUser) {
      const { data: userData, error: userError } = await admin.auth.getUser(accessToken);
      console.log('[Webpay] getUser resultado:', { hasUser: !!userData?.user, error: userError?.message });
      if (!userError) user = userData?.user ?? null;
    }

    // Intento 2 (fallback): endpoint REST /auth/v1/user
    if (!user) {
      console.log('[Webpay] Intentando fallback REST...');
      user = await getUserViaSupabaseRest(accessToken);
      console.log('[Webpay] Fallback resultado:', { hasUser: !!user });
    }

    if (!user) {
      console.log('[Webpay] Error: No se pudo obtener usuario');
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    console.log('[Webpay] Usuario autenticado:', user.id);

    // Defensa extra: si el frontend envía buyerId, debe coincidir
    if (buyerId && buyerId !== user.id) {
      console.log('[Webpay] Error: buyerId no coincide', { esperado: user.id, recibido: buyerId });
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // Ticket
    console.log('[Webpay] Buscando ticket:', ticketId);
    const { data: ticket, error: ticketError } = await admin
      .from('tickets')
      .select('id, status, price, seller_id')
      .eq('id', ticketId)
      .single();

    console.log('[Webpay] Ticket encontrado:', { ticket: ticket?.id, status: ticket?.status, error: ticketError?.message });

    if (ticketError || !ticket) {
      console.log('[Webpay] Error: Ticket no encontrado', ticketError?.message);
      return NextResponse.json({ error: 'Ticket no encontrado' }, { status: 404 });
    }

    if (ticket.status !== 'active') {
      console.log('[Webpay] Error: Ticket no activo, estado:', ticket.status);
      return NextResponse.json({ error: 'Ticket no disponible' }, { status: 409 });
    }

    if (ticket.seller_id === user.id) {
      console.log('[Webpay] Error: Usuario intenta comprar su propio ticket');
      return NextResponse.json({ error: 'No puedes comprar tu propio ticket' }, { status: 400 });
    }

    // Fees (2.5% con mínimo $1.200)
    const amount = Number(ticket.price);
    const { feeAmount, totalAmount } = calcPlatformFee(amount);

    console.log('[Webpay] Fees calculados:', { amount, feeAmount, totalAmount });

    const buyOrder = makeBuyOrder();
    const sessionId = makeSessionId();

    console.log('[Webpay] Generado:', { buyOrder, sessionId });

    // 1) Reservar ticket (race-safe)
    console.log('[Webpay] Intentando reservar ticket...');
    const { data: heldRows, error: holdError } = await admin
      .from('tickets')
      .update({ status: 'held' })
      .eq('id', ticketId)
      .eq('status', 'active')
      .select('id');

    console.log('[Webpay] Hold resultado:', { filas: heldRows?.length, error: holdError?.message });

    if (holdError || !heldRows || heldRows.length === 0) {
      console.log('[Webpay] Error: No se pudo reservar');
      return NextResponse.json(
        { error: 'No se pudo reservar el ticket (puede que ya lo hayan tomado)' },
        { status: 409 }
      );
    }

    // 2) Crear orden
    console.log('[Webpay] Insertando orden en DB...');
    const { data: order, error: orderError } = await admin
      .from('orders')
      .insert({
        ticket_id: ticketId,
        user_id: user.id, // comprador
        seller_id: ticket.seller_id,
        buyer_id: user.id,
        buy_order: buyOrder,
        session_id: sessionId,
        amount_clp: amount,
        fee_clp: feeAmount,
        total_clp: totalAmount,
        payment_state: 'created',
        status: 'pending',
        payment_provider: 'webpay',
        payment_method: 'webpay',
        currency: 'CLP',
      })
      .select('id')
      .single();

    console.log('[Webpay] Order insert resultado:', { orderId: order?.id, error: orderError?.message });

    if (orderError || !order) {
      console.log('[Webpay] Error creando orden:', orderError?.message);
      // rollback hold
      await admin.from('tickets').update({ status: 'active' }).eq('id', ticketId).eq('status', 'held');
      return NextResponse.json({ error: 'No se pudo crear la orden' }, { status: 500 });
    }

    console.log('[Webpay] Orden creada:', order.id);

    // 3) Crear sesión en Webpay
    const baseUrl = normalizeBaseUrl(process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin);
    const returnUrl = `${baseUrl}/api/payments/webpay/return`;

    let result;
    try {
      console.log('[Webpay] Iniciando transacción:', { buyOrder, sessionId, totalAmount, returnUrl });
      const transaction = getWebpayTransaction();
      result = await transaction.create(buyOrder, sessionId, totalAmount, returnUrl);
      console.log('[Webpay] Transacción creada exitosamente:', { token: result.token?.slice(0, 8) + '...' });
    } catch (e) {
      console.error('[Webpay] Error creando transacción:', e.message, e);
      // rollback hold + orden
      await admin.from('tickets').update({ status: 'active' }).eq('id', ticketId).eq('status', 'held');
      await admin.from('orders').update({ payment_state: 'failed', payment_status: 'failed' }).eq('id', order.id);
      throw new Error(`Webpay error: ${e.message}`);
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

    console.log('[Webpay] Respuesta exitosa:', { token: result.token?.slice(0, 8) + '...' });
    return NextResponse.json({ token: result.token, url: result.url }, { status: 200 });
  } catch (err) {
    console.error('[Webpay] Error en create-session:', err.message, err);
    return NextResponse.json({ error: 'Error interno: ' + err.message }, { status: 500 });
  }
}
