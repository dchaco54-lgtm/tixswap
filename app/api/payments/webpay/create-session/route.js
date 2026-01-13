import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getWebpayTransaction } from '@/lib/webpay';
import { calculateFees } from '@/lib/fees';

const BUYABLE_STATUSES = new Set(['active', 'available']);

export async function POST(req) {
  const supabase = createRouteHandlerClient({ cookies });
  const admin = supabaseAdmin();

  let ticketId;
  let returnUrl;
  let heldTicket = null;
  let createdOrder = null;

  try {
    const body = await req.json();
    ticketId = body?.ticketId;
    returnUrl = body?.returnUrl;

    if (!ticketId) {
      return NextResponse.json({ error: 'ticketId is required' }, { status: 400 });
    }
    if (!returnUrl) {
      return NextResponse.json({ error: 'returnUrl is required' }, { status: 400 });
    }

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const user = userData.user;

    // 1) Load ticket + validate buyable
    const { data: ticket, error: ticketErr } = await admin
      .from('tickets')
      .select('id, event_id, price, status')
      .eq('id', ticketId)
      .single();

    if (ticketErr || !ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    }

    if (!BUYABLE_STATUSES.has(ticket.status)) {
      return NextResponse.json(
        { error: `Ticket not available (current status: ${ticket.status})` },
        { status: 409 }
      );
    }

    // 2) HOLD ticket (atomic-ish)
    const { data: holdRes, error: holdErr } = await admin
      .from('tickets')
      .update({ status: 'held' })
      .eq('id', ticketId)
      .in('status', Array.from(BUYABLE_STATUSES))
      .select('id, status')
      .single();

    if (holdErr || !holdRes) {
      return NextResponse.json(
        { error: 'Could not reserve ticket (maybe someone took it)' },
        { status: 409 }
      );
    }
    heldTicket = holdRes;

    // 3) Create order
    const fees = calculateFees(ticket.price);
    const buyOrder = `TSW-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const sessionId = user.id;

    const { data: order, error: orderErr } = await admin
      .from('orders')
      .insert({
        ticket_id: ticketId,
        buyer_id: user.id,
        event_id: ticket.event_id,
        status: 'pending_payment',
        total_amount: ticket.price,
        fees_clp: fees.fee,
        total_clp: fees.total,
        payment_provider: 'webpay',
        payment_state: 'created',
        buy_order: buyOrder,
        session_id: sessionId,
      })
      .select('*')
      .single();

    if (orderErr || !order) {
      // rollback hold
      await admin.from('tickets').update({ status: 'active' }).eq('id', ticketId).eq('status', 'held');
      return NextResponse.json({ error: 'Failed to create order' }, { status: 500 });
    }
    createdOrder = order;

    // 4) Create Webpay transaction
    const tx = getWebpayTransaction();
    const response = await tx.create(buyOrder, sessionId, fees.total, returnUrl);

    // 5) Persist token/url
    const { error: updErr } = await admin
      .from('orders')
      .update({
        payment_request_id: response.token,
        webpay_token: response.token,
        payment_process_url: response.url,
        payment_payload: response,
      })
      .eq('id', order.id);

    if (updErr) {
      // rollback hold + mark order failed
      await admin.from('orders').update({ status: 'payment_failed', payment_state: 'error' }).eq('id', order.id);
      await admin.from('tickets').update({ status: 'active' }).eq('id', ticketId).eq('status', 'held');
      return NextResponse.json({ error: 'Failed to persist webpay session' }, { status: 500 });
    }

    return NextResponse.json({ url: response.url, token: response.token });
  } catch (e) {
    console.error('Webpay create-session error:', e);

    // rollback if needed
    try {
      if (createdOrder?.id) {
        await admin.from('orders').update({ status: 'payment_failed', payment_state: 'error' }).eq('id', createdOrder.id);
      }
      if (ticketId && heldTicket?.id) {
        await admin.from('tickets').update({ status: 'active' }).eq('id', ticketId).eq('status', 'held');
      }
    } catch (rollbackErr) {
      console.error('Rollback error:', rollbackErr);
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
