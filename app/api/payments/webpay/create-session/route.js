import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getWebpayTransaction } from '@/lib/webpay';

function timeout(ms, message) {
  return new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms));
}

function getBaseUrl() {
  const raw =
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '') ||
    'https://www.tixswap.cl';
  return raw.replace(/\/+$/, '');
}

export async function POST(req) {
  let sb = null;
  let ticketId = null;
  let ticketHeld = false;
  let orderId = null;

  try {
    const body = await req.json().catch(() => ({}));
    ticketId = body?.ticketId;
    const buyerId = body?.buyerId;

    if (!ticketId || !buyerId) {
      return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 });
    }

    sb = supabaseAdmin();

    // Get ticket + fees (re-validate on server)
    const { data: ticket, error: ticketErr } = await sb
      .from('tickets')
      .select('id, price, status')
      .eq('id', ticketId)
      .single();

    if (ticketErr || !ticket) return NextResponse.json({ error: 'Ticket no encontrado' }, { status: 404 });
    if (ticket.status !== 'active') return NextResponse.json({ error: 'Ticket no disponible' }, { status: 409 });

    const platformFee = Math.max(Math.round(ticket.price * 0.025), 1200);
    const totalDue = ticket.price + platformFee;

    // Hold ticket (best effort: fallback if hold_expires_at column doesn't exist)
    const holdMinutes = Number(process.env.CHECKOUT_HOLD_MINUTES || 10);
    const holdUntil = new Date(Date.now() + holdMinutes * 60 * 1000).toISOString();

    let { error: holdErr } = await sb
      .from('tickets')
      .update({ status: 'held', hold_expires_at: holdUntil })
      .eq('id', ticketId)
      .eq('status', 'active');

    if (holdErr && /hold_expires_at/i.test(holdErr.message || '')) {
      ({ error: holdErr } = await sb
        .from('tickets')
        .update({ status: 'held' })
        .eq('id', ticketId)
        .eq('status', 'active'));
    }

    if (holdErr) {
      console.error('Failed to hold ticket:', holdErr);
      return NextResponse.json({ error: 'No se pudo reservar la entrada' }, { status: 409 });
    }
    ticketHeld = true;

    // Create order
    const { data: order, error: orderErr } = await sb
      .from('orders')
      .insert({
        buyer_id: buyerId,
        ticket_id: ticketId,
        amount: ticket.price,
        service_fee: platformFee,
        total_amount: totalDue,
        currency: 'CLP',
        status: 'pending',
        payment_state: 'initiated',
        payment_method: 'webpay',
      })
      .select()
      .single();

    if (orderErr || !order) {
      // rollback hold (best effort)
      let { error: releaseErr } = await sb
        .from('tickets')
        .update({ status: 'active', hold_expires_at: null })
        .eq('id', ticketId);

      if (releaseErr && /hold_expires_at/i.test(releaseErr.message || '')) {
        await sb.from('tickets').update({ status: 'active' }).eq('id', ticketId);
      }

      return NextResponse.json({ error: 'No se pudo crear la orden' }, { status: 500 });
    }

    orderId = order.id;

    // Create Webpay transaction
    const transaction = getWebpayTransaction();
    const returnUrl = `${getBaseUrl()}/api/payments/webpay/return?orderId=${orderId}`;

    const resp = await Promise.race([
      transaction.create(`TSW-${orderId}`, `SID-${orderId}`, totalDue, returnUrl),
      timeout(15000, 'Transbank no respondió a tiempo'),
    ]);

    // Save Webpay token/url
    const { error: updErr } = await sb
      .from('orders')
      .update({
        payment_request_id: resp.token,
        webpay_token: resp.token,
        webpay_url: resp.url,
      })
      .eq('id', orderId);

    if (updErr) console.error('Order update error:', updErr);

    return NextResponse.json({ url: resp.url, token: resp.token, orderId });
  } catch (err) {
    console.error('webpay/create-session error', err);

    // Best-effort rollback (avoid leaving the ticket stuck in "held")
    try {
      if (sb && ticketId && ticketHeld) {
        let { error: releaseErr } = await sb
          .from('tickets')
          .update({ status: 'active', hold_expires_at: null })
          .eq('id', ticketId);

        if (releaseErr && /hold_expires_at/i.test(releaseErr.message || '')) {
          await sb.from('tickets').update({ status: 'active' }).eq('id', ticketId);
        }
      }
      if (sb && orderId) {
        await sb.from('orders').delete().eq('id', orderId);
      }
    } catch (rollbackErr) {
      console.error('Rollback error (create-session):', rollbackErr);
    }

    const message = err?.message || 'Error interno';
    const status = /no respondió a tiempo/i.test(message) ? 504 : 500;

    return NextResponse.json({ error: message }, { status });
  }
}

