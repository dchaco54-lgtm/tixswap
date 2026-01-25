export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { buildTicketSelect, detectTicketColumns, normalizeTicket } from '@/lib/db/ticketSchema';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

// GET /api/tickets/my-publications
export async function GET(request) {
  try {
    // 1) Auth: preferir Bearer (front lo manda), fallback cookies
    const admin = supabaseAdmin();

    let userId = null;
    const authHeader = request.headers.get('authorization') || '';

    if (authHeader.toLowerCase().startsWith('bearer ')) {
      const token = authHeader.slice(7).trim();
      const { data: userRes, error: userErr } = await admin.auth.getUser(token);
      if (userErr || !userRes?.user) {
        return NextResponse.json({ error: 'Sesión inválida' }, { status: 401 });
      }
      userId = userRes.user.id;
    } else {
      const supabase = createClient(cookies());
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
      }
      userId = user.id;
    }

    // 2) Detectar columnas reales y armar select seguro
    const columns = await detectTicketColumns(admin);
    const selectStr = buildTicketSelect(columns);

    // 3) Query (admin para evitar RLS, pero filtrado por tu userId)
    let { data: tickets, error: ticketsErr } = await admin
      .from('tickets')
      .select(selectStr)
      .eq('seller_id', userId)
      .order('created_at', { ascending: false })
      .limit(100);

    // Fallback: si falla el embed `event:events(...)`, reintenta sin embed y arma el evento aparte.
    if (ticketsErr) {
      const msg = String(ticketsErr.message || '');
      const looksLikeRelationErr = /relationship|schema cache|Could not find/i.test(msg) && /events?/i.test(msg);

      if (!looksLikeRelationErr) {
        return NextResponse.json(
          { error: 'Error al obtener publicaciones', details: ticketsErr.message },
          { status: 500 }
        );
      }

      const selectNoEmbed = selectStr.replace(/,\s*event:events\([^)]*\)\s*$/i, '');

      const retry = await admin
        .from('tickets')
        .select(selectNoEmbed)
        .eq('seller_id', userId)
        .order('created_at', { ascending: false })
        .limit(100);

      tickets = retry.data || [];
      if (retry.error) {
        return NextResponse.json({ error: 'Error al obtener publicaciones', details: msg }, { status: 500 });
      }

      const eventIds = Array.from(new Set((tickets || []).map((t) => t?.event_id).filter(Boolean)));
      if (eventIds.length) {
        const { data: events, error: eErr } = await admin
          .from('events')
          .select('id,title,starts_at,venue,city')
          .in('id', eventIds);

        if (!eErr && Array.isArray(events)) {
          const map = Object.fromEntries(events.map((e) => [e.id, e]));
          tickets = (tickets || []).map((t) => ({ ...t, event: map[t.event_id] || null }));
        }
      }
    }

    const normTickets = (tickets || []).map(normalizeTicket);

    const active = normTickets.filter((t) => t.status === 'active' || t.status === 'available').length;
    const paused = normTickets.filter((t) => t.status === 'paused').length;
    const sold = normTickets.filter((t) => t.status === 'sold').length;

    return NextResponse.json({
      tickets: normTickets,
      summary: { total: normTickets.length, active, paused, sold },
    });
  } catch (err) {
    console.error('Error en GET /api/tickets/my-publications:', err);
    return NextResponse.json(
      { error: 'Error inesperado', details: err?.message },
      { status: 500 }
    );
  }
}
