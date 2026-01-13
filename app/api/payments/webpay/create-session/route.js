import { NextResponse } from 'next/server';
import { WebpayPlus } from 'transbank-sdk';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { calculateFees } from '@/lib/fees';

function getBaseUrl(req) {
  // Works for production + Vercel preview deployments (so return URL points to the right host)
  const proto = req.headers.get('x-forwarded-proto') || 'https';
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
  if (host) return `${proto}://${host}`;

  const env = process.env.NEXT_PUBLIC_SITE_URL;
  if (env) return env.replace(/\/$/, '');

  return 'http://localhost:3000';
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { ticketId } = body || {};

    if (!ticketId) {
      return NextResponse.json({ error: 'ticketId es requerido' }, { status: 400 });
    }

    const supabase = supabaseAdmin();

    // Fetch ticket
    const { data: ticket, error: tErr } = await supabase
      .from('tickets')
      .select('id, price, status, seller_id, event_id')
      .eq('id', ticketId)
      .maybeSingle();

    if (tErr) return NextResponse.json({ error: tErr.message }, { status: 500 });
    if (!ticket) return NextResponse.json({ error: 'Ticket no encontrado' }, { status: 404 });

    if (ticket.status !== 'active') {
      return NextResponse.json({ error: 'Ticket no disponible' }, { status: 409 });
    }

    const price = Number(ticket.price || 0);
    const fees = calculateFees(price);
    const total = price + fees.platformFee;

    // Create order
    const { data: order, error: oErr } = await supabase
      .from('orders')
      .insert({
        ticket_id: ticket.id,
        buyer_id: null,
        seller_id: ticket.seller_id,
        amount: price,
        fee: fees.platformFee,
        total_amount: total,
        status: 'pending_payment',
        payment_state: 'created',
      })
      .select('*')
      .single();

    if (oErr) return NextResponse.json({ error: oErr.message }, { status: 500 });

    // Hold ticket
    const { error: holdErr } = await supabase
      .from('tickets')
      .update({ status: 'held' })
      .eq('id', ticket.id)
      .eq('status', 'active');

    if (holdErr) {
      // rollback order
      await supabase.from('orders').delete().eq('id', order.id);
      return NextResponse.json({ error: holdErr.message }, { status: 500 });
    }

    // Webpay config
    const env = (process.env.WEBPAY_ENV || 'integration').toLowerCase();
    if (env === 'production') {
      WebpayPlus.configureForProduction(
        process.env.WEBPAY_COMMERCE_CODE,
        process.env.WEBPAY_API_KEY
      );
    } else {
      WebpayPlus.configureForIntegration(process.env.WEBPAY_COMMERCE_CODE);
    }

    const buyOrder = `TS-${order.id}`;
    const sessionId = `SID-${order.id}`;
    const returnUrl = `${getBaseUrl(request)}/api/payments/webpay/return?orderId=${order.id}`;

    const tx = new WebpayPlus.Transaction();
    const response = await tx.create(buyOrder, sessionId, total, returnUrl);

    // Save token/url
    await supabase
      .from('orders')
      .update({
        payment_state: 'initiated',
        webpay_token: response.token,
        webpay_url: response.url,
      })
      .eq('id', order.id);

    return NextResponse.json({ ok: true, orderId: order.id, token: response.token, url: response.url });
  } catch (e) {
    return NextResponse.json({ error: e?.message || 'Error creando sesión' }, { status: 500 });
  }
}
