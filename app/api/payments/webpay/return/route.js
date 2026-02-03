import { NextResponse } from 'next/server';

import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getWebpayTransaction } from '@/lib/webpay';
import { sendEmail } from '@/lib/email/resend';
import { templateOrderPaidBuyer, templateOrderPaidSeller } from '@/lib/email/templates';

export const dynamic = 'force-dynamic';

function normalizeBaseUrl(url) {
  if (!url) return '';
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

async function loadOrderEmailData(admin, order) {
  const ids = [order.buyer_id, order.seller_id].filter(Boolean);
  const profilesById = {};

  if (ids.length) {
    const { data: profiles } = await admin
      .from('profiles')
      .select('id, full_name, email')
      .in('id', ids);

    (profiles || []).forEach((p) => {
      profilesById[p.id] = p;
    });
  }

  let ticket = null;
  if (order.ticket_id) {
    const { data: t } = await admin
      .from('tickets')
      .select('id, event_id')
      .eq('id', order.ticket_id)
      .maybeSingle();
    ticket = t || null;
  }

  const eventId = order.event_id || ticket?.event_id || null;
  let eventName = null;
  if (eventId) {
    const { data: eventRow } = await admin
      .from('events')
      .select('title')
      .eq('id', eventId)
      .maybeSingle();
    eventName = eventRow?.title || null;
  }

  return {
    buyer: profilesById[order.buyer_id] || null,
    seller: profilesById[order.seller_id] || null,
    eventName,
  };
}

async function sendPaidEmails(admin, order, baseUrl) {
  try {
    const { buyer, seller, eventName } = await loadOrderEmailData(admin, order);

    if (buyer?.email) {
      const { subject, html } = templateOrderPaidBuyer({
        buyerName: buyer?.full_name || null,
        eventName,
        totalClp: order.total_clp ?? order.total_amount ?? null,
        orderId: order.id,
        link: `${baseUrl}/dashboard/purchases/${order.id}`,
      });

      const buyerRes = await sendEmail({ to: buyer.email, subject, html });
      if (!buyerRes.ok && !buyerRes.skipped) {
        console.warn('[Webpay Return] Buyer email error:', buyerRes.error);
      }
    }

    if (seller?.email) {
      const { subject, html } = templateOrderPaidSeller({
        sellerName: seller?.full_name || null,
        eventName,
        amountClp: order.amount_clp ?? order.amount ?? null,
        orderId: order.id,
        ticketId: order.ticket_id,
        link: `${baseUrl}/dashboard/publications/${order.ticket_id}`,
      });

      const sellerRes = await sendEmail({ to: seller.email, subject, html });
      if (!sellerRes.ok && !sellerRes.skipped) {
        console.warn('[Webpay Return] Seller email error:', sellerRes.error);
      }
    }
  } catch (err) {
    console.warn('[Webpay Return] Email error:', err);
  }
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
        .select('id, ticket_id, status, buyer_id, seller_id, event_id, amount, amount_clp, total_amount, total_clp, fee_clp')
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
      .select('id, ticket_id, status, buyer_id, seller_id, event_id, amount, amount_clp, total_amount, total_clp, fee_clp')
      .eq('buy_order', buyOrder)
      .single();

    if (orderError || !order) {
      return NextResponse.redirect(`${redirectBase}?payment=order_not_found`, { status: 303 });
    }

    // Aprobado típicamente: response_code === 0 y status === 'AUTHORIZED'
    const approved = Number(result?.response_code) === 0 && result?.status === 'AUTHORIZED';

    if (approved) {
      if (order.status === 'paid') {
        return NextResponse.redirect(`${redirectBase}?payment=success&order=${order.id}`, {
          status: 303,
        });
      }

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
      await sendPaidEmails(admin, order, baseUrl);

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
        .select('id, ticket_id, status, buyer_id, seller_id, event_id, amount, amount_clp, total_amount, total_clp, fee_clp')
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
      .select('id, ticket_id, status, buyer_id, seller_id, event_id, amount, amount_clp, total_amount, total_clp, fee_clp')
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

      if (order.status === 'paid') {
        return NextResponse.redirect(`${redirectBase}?payment=success&order=${order.id}`, {
          status: 303,
        });
      }
      
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
      await sendPaidEmails(admin, order, baseUrl);

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
