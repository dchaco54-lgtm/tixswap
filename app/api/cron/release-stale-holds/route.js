import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

const DEFAULT_TTL_MINUTES = 20;

export async function GET(request) {
  try {
    const secret = process.env.CRON_SECRET;
    const auth = request.headers.get('authorization') || '';

    // If a secret is configured, require: Authorization: Bearer <CRON_SECRET>
    if (secret) {
      const ok = auth === `Bearer ${secret}`;
      if (!ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(request.url);
    const ttl = Number(url.searchParams.get('ttl')) || DEFAULT_TTL_MINUTES;
    const cutoffIso = new Date(Date.now() - ttl * 60 * 1000).toISOString();

    const supabase = supabaseAdmin();

    // Find stale pending orders
    const { data: orders, error: oErr } = await supabase
      .from('orders')
      .select('id, ticket_id, status, created_at')
      .eq('status', 'pending_payment')
      .lt('created_at', cutoffIso)
      .limit(500);

    if (oErr) return NextResponse.json({ error: oErr.message }, { status: 500 });

    const ticketIds = (orders || []).map((o) => o.ticket_id).filter(Boolean);
    const orderIds = (orders || []).map((o) => o.id).filter(Boolean);

    if (!ticketIds.length || !orderIds.length) {
      return NextResponse.json({ ok: true, released: 0, ttl_minutes: ttl });
    }

    // Expire orders
    const { error: expErr } = await supabase
      .from('orders')
      .update({ status: 'expired', payment_state: 'expired' })
      .in('id', orderIds);

    if (expErr) return NextResponse.json({ error: expErr.message }, { status: 500 });

    // Release tickets back to active
    const { error: relErr } = await supabase
      .from('tickets')
      .update({ status: 'active' })
      .in('id', ticketIds)
      .eq('status', 'held');

    if (relErr) return NextResponse.json({ error: relErr.message }, { status: 500 });

    return NextResponse.json({ ok: true, released: ticketIds.length, ttl_minutes: ttl });
  } catch (e) {
    return NextResponse.json({ error: e?.message || 'Cron error' }, { status: 500 });
  }
}
