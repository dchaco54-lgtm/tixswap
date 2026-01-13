import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getWebpayTransaction } from '@/lib/webpay';

export async function POST(request) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  const supabase = supabaseAdmin();

  try {
    const formData = await request.formData();

    // Webpay success normally sends token_ws
    const tokenWs = formData.get('token_ws')?.toString() || null;

    // When user cancels, Webpay often sends TBK_* fields (token_ws absent)
    const tbkBuyOrder = formData.get('TBK_ORDEN_COMPRA')?.toString() || null;

    // 1) CANCELLED FLOW (no token_ws)
    if (!tokenWs) {
      if (tbkBuyOrder) {
        const { data: order } = await supabase
          .from('orders')
          .select('id, ticket_id, status')
          .eq('buy_order', tbkBuyOrder)
          .single();

        if (order) {
          await supabase
            .from('orders')
            .update({ status: 'canceled', payment_state: 'canceled' })
            .eq('id', order.id);

          await supabase
            .from('tickets')
            .update({ status: 'active', hold_expires_at: null })
            .eq('id', order.ticket_id)
            .eq('status', 'held');

          const redirect = new URL(`/checkout/${order.ticket_id}`, siteUrl);
          redirect.searchParams.set('payment', 'failed');
          redirect.searchParams.set('provider', 'webpay');
          return NextResponse.redirect(redirect);
        }
      }

      return NextResponse.redirect(new URL('/checkout?payment=failed&provider=webpay', siteUrl));
    }

    // 2) Find order by token
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .select('id, ticket_id, buy_order, session_id, status')
      .or(`payment_request_id.eq.${tokenWs},webpay_token.eq.${tokenWs}`)
      .single();

    if (orderErr || !order) {
      return NextResponse.redirect(new URL('/checkout?payment=failed&provider=webpay', siteUrl));
    }

    const okRedirect = new URL(`/checkout/${order.ticket_id}`, siteUrl);
    okRedirect.searchParams.set('payment', 'success');
    okRedirect.searchParams.set('provider', 'webpay');

    const failRedirect = new URL(`/checkout/${order.ticket_id}`, siteUrl);
    failRedirect.searchParams.set('payment', 'failed');
    failRedirect.searchParams.set('provider', 'webpay');

    // 3) Commit transaction with Webpay
    const tx = getWebpayTransaction();
    const commit = await tx.commit(tokenWs);

    const ok = commit?.status === 'AUTHORIZED' && commit?.response_code === 0;

    if (ok) {
      await supabase
        .from('orders')
        .update({
          status: 'paid',
          payment_state: 'paid',
          paid_at: new Date().toISOString(),
          total_paid_clp: commit.amount,
          payment_method: commit.payment_type_code || null,
          payment_payload: commit,
        })
        .eq('id', order.id);

      await supabase
        .from('tickets')
        .update({ status: 'sold', hold_expires_at: null })
        .eq('id', order.ticket_id);

      return NextResponse.redirect(okRedirect);
    }

    // 4) FAIL / NOT AUTHORIZED => release ticket
    await supabase
      .from('orders')
      .update({
        status: 'payment_failed',
        payment_state: 'failed',
        payment_payload: commit,
      })
      .eq('id', order.id);

    await supabase
      .from('tickets')
      .update({ status: 'active', hold_expires_at: null })
      .eq('id', order.ticket_id)
      .eq('status', 'held');

    return NextResponse.redirect(failRedirect);
  } catch (err) {
    console.error('Webpay return error:', err);
    return NextResponse.redirect(new URL('/checkout?payment=failed&provider=webpay', siteUrl));
  }
}

