import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { calculateFees } from '@/lib/fees';

export const runtime = 'nodejs';

function normalizeEventStartsAt(eventRow) {
  const startsAt = eventRow?.starts_at ?? eventRow?.startsAt ?? null;
  if (startsAt) return startsAt;

  const date = eventRow?.date ?? null;
  const time = eventRow?.time ?? null;
  if (!date) return null;

  const hhmm = (time && typeof time === 'string') ? time : '00:00';
  try {
    const d = new Date(`${date}T${hhmm}:00`);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  } catch (_) {}
  return null;
}

function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function pickOriginalPrice(ticket) {
  // soporta varios nombres por compatibilidad
  return (
    toNum(ticket?.original_price) ??
    toNum(ticket?.price_original) ??
    toNum(ticket?.originalPrice) ??
    toNum(ticket?.original_price_clp) ??
    null
  );
}

function pickCurrentPrice(ticket) {
  // candidatos comunes en el proyecto
  const candidates = [
    toNum(ticket?.price),
    toNum(ticket?.price_clp),
    toNum(ticket?.amount_clp),
    toNum(ticket?.amount),
  ].filter((x) => x !== null);

  if (candidates.length === 0) return 0;

  const original = pickOriginalPrice(ticket);
  if (original !== null) {
    // si hay uno distinto al original, preferimos ese como "precio de venta"
    const diff = candidates.find((p) => p !== original);
    if (diff !== undefined) return diff;
  }

  return candidates[0];
}

export async function GET(req, { params }) {
  try {
    const ticketId = params?.id;
    if (!ticketId) {
      return NextResponse.json({ error: 'Falta id' }, { status: 400 });
    }

    const sb = supabaseAdmin();

    // ticket + evento (join)
    const { data: ticketRow, error: ticketErr } = await sb
      .from('tickets')
      .select('*, events(*)')
      .eq('id', ticketId)
      .single();

    if (ticketErr || !ticketRow) {
      return NextResponse.json({ error: 'Ticket no encontrado' }, { status: 404 });
    }

    const status = String(ticketRow.status || '').toLowerCase();
    const allowedStatuses = new Set(['active', 'held']);
    if (status && !allowedStatuses.has(status)) {
      return NextResponse.json(
        { error: `Ticket no disponible (estado: ${ticketRow.status})` },
        { status: 409 }
      );
    }

    const eventRow = ticketRow.events || null;
    if (!eventRow) {
      // por si la relación no está creada en Supabase
      const { data: e, error: eErr } = await sb
        .from('events')
        .select('*')
        .eq('id', ticketRow.event_id)
        .single();

      if (eErr || !e) {
        return NextResponse.json({ error: 'Evento no encontrado' }, { status: 404 });
      }
      ticketRow.events = e;
    }

    const sellerId = ticketRow.seller_id ?? ticketRow.owner_id ?? ticketRow.user_id ?? null;

    // seller (perfil)
    let seller = null;
    if (sellerId) {
      const { data: sellerRow } = await sb
        .from('profiles')
        .select('id, full_name, username, avatar_url, created_at')
        .eq('id', sellerId)
        .single();

      seller = sellerRow ?? null;
    }

    // ratings + stats (tabla "ratings" como en checkout/preview)
    let sellerRatings = [];
    let sellerStats = { averageStars: null, totalRatings: 0 };

    if (sellerId) {
      const { data: ratings } = await sb
        .from('ratings')
        .select('id, rater_id, stars, comment, created_at')
        .eq('target_id', sellerId)
        .order('created_at', { ascending: false })
        .limit(20);

      const safeRatings = Array.isArray(ratings) ? ratings : [];
      const total = safeRatings.length;

      if (total > 0) {
        const sum = safeRatings.reduce((acc, r) => acc + (Number(r.stars) || 0), 0);
        sellerStats = {
          averageStars: Math.round((sum / total) * 10) / 10,
          totalRatings: total,
        };
      }

      const raterIds = [...new Set(safeRatings.map((r) => r.rater_id).filter(Boolean))];
      let ratersById = {};
      if (raterIds.length > 0) {
        const { data: raters } = await sb
          .from('profiles')
          .select('id, full_name, username, avatar_url')
          .in('id', raterIds);

        ratersById = (raters || []).reduce((acc, p) => {
          acc[p.id] = p;
          return acc;
        }, {});
      }

      sellerRatings = safeRatings.map((r) => ({
        id: r.id,
        stars: r.stars,
        comment: r.comment,
        created_at: r.created_at,
        rater: ratersById[r.rater_id] ?? { id: r.rater_id, full_name: 'Usuario' },
      }));
    }

    const originalPrice = pickOriginalPrice(ticketRow);
    const price = pickCurrentPrice(ticketRow);

    // ✅ fees: por defecto (2.5% + mínimo) -> NO le pasamos tier/rol
    const fees = calculateFees(price);

    const event = ticketRow.events;
    const eventTitle = event.title || event.name || 'Evento';
    const eventStartsAt = normalizeEventStartsAt(event);

    return NextResponse.json({
      ticket: {
        id: ticketRow.id,
        event_id: ticketRow.event_id,
        seller_id: sellerId,
        section: ticketRow.section,
        row: ticketRow.row,
        seat: ticketRow.seat,
        notes: ticketRow.notes,
        original_price: originalPrice,
        price,
        currency: 'CLP',
        status: ticketRow.status,
      },
      event: {
        id: event.id,
        title: eventTitle,
        venue: event.venue,
        city: event.city,
        country: event.country,
        starts_at: eventStartsAt,
        image_url: event.image_url ?? event.poster_url ?? event.cover_image ?? null,
      },
      seller,
      sellerStats,
      sellerRatings,
      fees,
    });
  } catch (err) {
    console.error('tickets/[id] GET error', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

