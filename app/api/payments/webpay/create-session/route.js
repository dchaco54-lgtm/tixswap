import { NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { calculateFees } from '@/lib/fees';
import { getWebpayTransaction } from '@/lib/webpay';

function getBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}` ||
    'https://www.tixswap.cl'
  );
}

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const ticketId = body?.ticketId;
    const buyerId = body?.buyerId;

    if (!ticketId) return NextResponse.json({ error: 'Falta ticketId' }, { status: 400 });
    if (!buyerId) return NextResponse.json({ error: 'Debes iniciar sesión' }, { status: 401 });

    const sb = supabaseAdmin();

    // 1) Validar ticket
    const { data: ticket, error: ticketErr } = await sb
      .from('tickets')
      .select('id, price, status, seller_id, event_id')
      .eq('id', ticketId)
      .single();

    if (ticketErr || !ticket) return NextResponse.json({ error: 'Ticket no encontrado' }, { status: 404 });
    if ((ticket.status || '').toLowerCase() !== 'active') {
      return NextResponse.json({ error: `Ticket no disponible (estado: ${ticket.status})` }, { status: 409 });
    }

    // 2) Bloquear: pasar a held con expiración corta
    const holdMinutes = Number(process.env.CHECKOUT_HOLD_MINUTES || 10);
    const holdUntil = new Date(Date.now() + holdMinutes * 60_000).toISOString();

    const { error: holdErr } = await sb
      .from('tickets')
      .update({ status: 'held', hold_expires_at: holdUntil })
      .eq('id', ticketId)
      .eq('status', 'active');

    if (holdErr) return NextResponse.json({ error: 'No se pudo reservar la entrada' }, { status: 409 });

    // 3) Crear orden
    const ticketPrice = Number(ticket.price || 0);
    const fees = calculateFees(ticketPrice);

    const buyOrder = `TS-${nanoid(10)}`;
    const sessionId = nanoid(16);

    const { data: order, error: orderErr } = await sb
      .from('orders')
      .insert({
        buy_order: buyOrder,
        session_id: sessionId,
        ticket_id: ticketId,
        event_id: ticket.event_id,
        seller_id: ticket.seller_id,
        buyer_id: buyerId,
        ticket_price_clp: fees.ticketPrice,
        platform_fee_clp: fees.platformFee,
        seller_payout_clp: fees.sellerPayout,
        amount_clp: fees.totalDue,
        status: 'pending',
      })
      .select('id, buy_order, session_id')
      .single();

    if (orderErr || !order) {
      // rollback hold
      await sb.from('tickets').update({ status: 'active', hold_expires_at: null }).eq('id', ticketId);
      return NextResponse.json({ error: 'No se pudo crear la orden' }, { status: 500 });
    }

    // 4) Crear transacción Webpay
    const returnUrl = `${getBaseUrl()}/api/payments/webpay/return?orderId=${order.id}`;
    const transaction = getWebpayTransaction();

    const resp = await transaction.create(order.buy_order, order.session_id, fees.totalDue, returnUrl);

    // Persistir token + url (por si se necesita reintento)
    await sb
      .from('orders')
      .update({
        webpay_token: resp.token,
        webpay_url: resp.url,
      })
      .eq('id', order.id);

    return NextResponse.json({
      url: resp.url,
      token: resp.token,
      buyOrder: order.buy_order,
      sessionId: order.session_id,
      orderId: order.id,
      amount: fees.totalDue,
      fees,
    });
  } catch (err) {
    console.error('webpay/create-session error', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
