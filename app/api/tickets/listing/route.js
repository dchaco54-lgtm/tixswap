import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

function parseClpInt(value) {
  if (value === null || value === undefined) return null;
  const n = typeof value === 'number' ? value : Number(String(value).replace(/[^\d]/g, ''));
  if (!Number.isFinite(n)) return null;
  const i = Math.trunc(n);
  if (i <= 0) return null;
  return i;
}

function calcPlatformFeeClp(amountClp) {
  // regla: 2.5% con mínimo 1.200
  const pct = Math.ceil(amountClp * 0.025);
  return Math.max(pct, 1200);
}

async function getTicketsColumns(sb) {
  const { data, error } = await sb
    .from('information_schema.columns')
    .select('column_name')
    .eq('table_schema', 'public')
    .eq('table_name', 'tickets');

  if (error || !Array.isArray(data)) return new Set();
  return new Set(data.map((r) => r.column_name));
}

function getBearerToken(req) {
  const auth = req.headers.get('authorization') || '';
  const m = auth.match(/^Bearer\s+(.+)$/i);
  return m?.[1]?.trim() || null;
}

export async function PATCH(req) {
  try {
    const body = await req.json().catch(() => ({}));

    // Soportar ambos formatos (por si alguna parte manda ?id=)
    const url = new URL(req.url);
    const ticketId = body?.ticketId || url.searchParams.get('id');

    const newPrice = parseClpInt(body?.price);
    const status = body?.status ? String(body.status).toLowerCase() : null;

    if (!ticketId) {
      return NextResponse.json({ error: 'Falta ticketId' }, { status: 400 });
    }

    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Auth usuario por token (para no dejar esto abierto)
    const token = getBearerToken(req);
    if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const { data: authData, error: authErr } = await sb.auth.getUser(token);
    if (authErr || !authData?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    const userId = authData.user.id;

    // Traer ticket y validar ownership
    const { data: ticket, error: tErr } = await sb
      .from('tickets')
      .select('*')
      .eq('id', ticketId)
      .single();

    if (tErr || !ticket) {
      return NextResponse.json({ error: 'Ticket no encontrado' }, { status: 404 });
    }

    const sellerId = ticket.seller_id ?? ticket.owner_id ?? ticket.user_id ?? null;
    if (!sellerId || sellerId !== userId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const cols = await getTicketsColumns(sb);

    const updateData = {};

    // ✅ Precio: si existe price_clp, lo actualizamos SIEMPRE (porque ese es el que suele leer el dashboard)
    if (newPrice !== null) {
      if (cols.has('price_clp')) updateData.price_clp = newPrice;

      // price lo actualizamos solo si NO existe price_clp,
      // o si existe un campo explícito de original_price (para no pisar "original" por accidente)
      const hasExplicitOriginal =
        cols.has('original_price') || cols.has('price_original') || cols.has('original_price_clp');

      if (!cols.has('price_clp') || hasExplicitOriginal) {
        if (cols.has('price')) updateData.price = newPrice;
      }

      if (cols.has('platform_fee')) {
        updateData.platform_fee = calcPlatformFeeClp(newPrice);
      }
    }

    // Status
    if (status) {
      const allowed = new Set(['active', 'paused', 'held', 'sold', 'cancelled', 'inactive']);
      if (!allowed.has(status)) {
        return NextResponse.json({ error: `Status inválido: ${status}` }, { status: 400 });
      }
      if (cols.has('status')) updateData.status = status;
    }

    // Notes (si tu modal lo manda)
    if (body?.notes !== undefined && cols.has('notes')) {
      updateData.notes = String(body.notes);
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ ok: true, ticket }, { status: 200 });
    }

    const { data: updated, error: upErr } = await sb
      .from('tickets')
      .update(updateData)
      .eq('id', ticketId)
      .select('*')
      .single();

    if (upErr) {
      return NextResponse.json({ error: upErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, ticket: updated }, { status: 200 });
  } catch (e) {
    console.error('tickets/listing PATCH error', e);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function DELETE(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const url = new URL(req.url);
    const ticketId = body?.ticketId || url.searchParams.get('id');

    if (!ticketId) {
      return NextResponse.json({ error: 'Falta ticketId' }, { status: 400 });
    }

    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const token = getBearerToken(req);
    if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const { data: authData, error: authErr } = await sb.auth.getUser(token);
    if (authErr || !authData?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    const userId = authData.user.id;

    const { data: ticket, error: tErr } = await sb
      .from('tickets')
      .select('*')
      .eq('id', ticketId)
      .single();

    if (tErr || !ticket) {
      return NextResponse.json({ error: 'Ticket no encontrado' }, { status: 404 });
    }

    const sellerId = ticket.seller_id ?? ticket.owner_id ?? ticket.user_id ?? null;
    if (!sellerId || sellerId !== userId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const cols = await getTicketsColumns(sb);

    // Soft delete si existe deleted_at, si no hard delete
    if (cols.has('deleted_at')) {
      const { error: delErr } = await sb
        .from('tickets')
        .update({ deleted_at: new Date().toISOString(), status: 'inactive' })
        .eq('id', ticketId);

      if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    const { error: hardErr } = await sb.from('tickets').delete().eq('id', ticketId);
    if (hardErr) return NextResponse.json({ error: hardErr.message }, { status: 500 });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e) {
    console.error('tickets/listing DELETE error', e);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

