import { NextResponse } from 'next/server';

import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getWebpayTransaction } from '@/lib/webpay';

export const dynamic = 'force-dynamic';

function normalizeBaseUrl(url) {
  if (!url) return '';
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

export async function POST(req) {
  try {
    const formData = await req.formData();

    // Flujo normal: token_ws
    const token = formData.get('token_ws');

    // Flujo cancelación/timeout: vienen estos campos, sin token_ws
    const tbkBuyOrder = formData.get('TBK_ORDEN_COMPRA');

    const baseUrl = normalizeBaseUrl(process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin);
    const redirectBase = `${baseUrl}/dashboard/purchases`;

    const admin = supabaseAdmin();

    // Si canceló antes de pagar en Webpay
    if (!token && tbkBuyOrder) {
      const { data: order } = await admin
        .from('orders')
        .select('id, ticket_id')
        .eq('buy_order', tbkBuyOrder)
        .single();

      if (order?.ticket_id) {
        await admin.from('tickets').update({ status: 'active' }).eq('id', order.ticket_id);
      }

      if (order?.id) {
        await admin
          .from('orders')
          .update({ status: 'canceled', payment_state: 'canceled' })
          .eq('id', order.id);
      }

      return NextResponse.redirect(`${redirectBase}?payment=canceled`, { status: 303 });
    }

    if (!token) {
      // No sabemos qué pasó, pero no hay token ni buyOrder
      return NextResponse.redirect(`${redirectBase}?payment=unknown`, { status: 303 });
    }

    // Commit en Webpay
    const transaction = getWebpayTransaction();
    const result = await transaction.commit(token);

    const buyOrder = result?.buy_order;

    // Buscar orden
    const { data: order, error: orderError } = await admin
      .from('orders')
      .select('id, ticket_id')
      .eq('buy_order', buyOrder)
      .single();

    if (orderError || !order) {
      return NextResponse.redirect(`${redirectBase}?payment=order_not_found`, { status: 303 });
    }

    // Aprobado típicamente: response_code === 0 y status === 'AUTHORIZED'
    const approved = Number(result?.response_code) === 0 && result?.status === 'AUTHORIZED';

    if (approved) {
      // Marcar orden pagada + ticket vendido
      await admin
        .from('orders')
        .update({
          status: 'paid',
          payment_state: result?.status || 'AUTHORIZED',
          webpay_token: token,
          webpay_authorization_code: result?.authorization_code,
          webpay_payment_type_code: result?.payment_type_code,
          webpay_card_last4: result?.card_detail?.card_number,
          webpay_installments_number: result?.installments_number,
          paid_at: new Date().toISOString(),
        })
        .eq('id', order.id);

      await admin.from('tickets').update({ status: 'sold' }).eq('id', order.ticket_id);

      return NextResponse.redirect(`${redirectBase}?payment=success&order=${order.id}`, {
        status: 303,
      });
    }

    // Rechazado / fallido => liberar ticket
    await admin
      .from('orders')
      .update({
        status: 'failed',
        payment_state: result?.status || 'FAILED',
        webpay_token: token,
      })
      .eq('id', order.id);

    await admin.from('tickets').update({ status: 'active' }).eq('id', order.ticket_id);

    return NextResponse.redirect(`${redirectBase}?payment=failed&order=${order.id}`, {
      status: 303,
    });
  } catch (err) {
    console.error('Webpay return error:', err);
    const baseUrl = normalizeBaseUrl(process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin);
    return NextResponse.redirect(`${baseUrl}/dashboard/purchases?payment=error`, { status: 303 });
  }
}

// Webpay puede redirigir con GET (token_ws en query string)
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get('token_ws');
    const tbkBuyOrder = searchParams.get('TBK_ORDEN_COMPRA');
    const tbkIdSesion = searchParams.get('TBK_ID_SESION');

    const baseUrl = normalizeBaseUrl(process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin);
    const redirectBase = `${baseUrl}/dashboard/purchases`;

    const admin = supabaseAdmin();

    console.log('[Webpay Return] GET:', { token: !!token, tbkBuyOrder, tbkIdSesion });

    // Si canceló antes de pagar en Webpay
    if (!token && tbkBuyOrder) {
      const { data: order } = await admin
        .from('orders')
        .select('id, ticket_id')
        .eq('buy_order', tbkBuyOrder)
        .single();

      if (order?.ticket_id) {
        await admin.from('tickets').update({ status: 'active' }).eq('id', order.ticket_id);
      }

      if (order?.id) {
        await admin
          .from('orders')
          .update({ status: 'canceled', payment_state: 'canceled' })
          .eq('id', order.id);
      }

      return NextResponse.redirect(`${redirectBase}?payment=canceled`, { status: 303 });
    }

    if (!token) {
      return NextResponse.redirect(`${redirectBase}?payment=unknown`, { status: 303 });
    }

    // Commit en Webpay
    console.log('[Webpay Return] Committing transaction:', token);
    const transaction = getWebpayTransaction();
    const result = await transaction.commit(token);

    console.log('[Webpay Return] Result:', {
      buyOrder: result?.buy_order,
      status: result?.status,
      responseCode: result?.response_code,
    });

    const buyOrder = result?.buy_order;

    // Buscar orden
    const { data: order, error: orderError } = await admin
      .from('orders')
      .select('id, ticket_id')
      .eq('buy_order', buyOrder)
      .single();

    if (orderError || !order) {
      console.error('[Webpay Return] Order not found:', buyOrder);
      return NextResponse.redirect(`${redirectBase}?payment=order_not_found`, { status: 303 });
    }

    // Aprobado típicamente: response_code === 0 y status === 'AUTHORIZED'
    const approved = Number(result?.response_code) === 0 && result?.status === 'AUTHORIZED';

    if (approved) {
      console.log('[Webpay Return] Payment approved for order:', order.id);
      
      // Marcar orden pagada + ticket vendido
      await admin
        .from('orders')
        .update({
          status: 'paid',
          payment_state: result?.status || 'AUTHORIZED',
          webpay_token: token,
          webpay_authorization_code: result?.authorization_code,
          webpay_payment_type_code: result?.payment_type_code,
          webpay_card_last4: result?.card_detail?.card_number,
          webpay_installments_number: result?.installments_number,
          paid_at: new Date().toISOString(),
        })
        .eq('id', order.id);

      await admin.from('tickets').update({ status: 'sold' }).eq('id', order.ticket_id);

      return NextResponse.redirect(`${redirectBase}?payment=success&order=${order.id}`, {
        status: 303,
      });
    }

    // Rechazado / fallido => liberar ticket
    console.log('[Webpay Return] Payment failed/rejected for order:', order.id);
    
    await admin
      .from('orders')
      .update({
        status: 'failed',
        payment_state: result?.status || 'FAILED',
        webpay_token: token,
      })
      .eq('id', order.id);

    await admin.from('tickets').update({ status: 'active' }).eq('id', order.ticket_id);

    return NextResponse.redirect(`${redirectBase}?payment=failed&order=${order.id}`, {
      status: 303,
    });
  } catch (err) {
    console.error('[Webpay Return] Error:', err);
    const baseUrl = normalizeBaseUrl(process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin);
    return NextResponse.redirect(`${baseUrl}/dashboard/purchases?payment=error`, { status: 303 });
  }
}
