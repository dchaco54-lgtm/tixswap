import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { calculateFees } from '@/lib/fees';

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

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const ticketId = body?.ticketId;

    if (!ticketId) {
      return NextResponse.json({ error: 'Falta ticketId' }, { status: 400 });
    }

    const sb = supabaseAdmin();

    const { data: ticket, error: ticketErr } = await sb
      .from('tickets')
      .select('*')
      .eq('id', ticketId)
      .single();

    if (ticketErr || !ticket) {
      return NextResponse.json({ error: 'Ticket no encontrado' }, { status: 404 });
    }

    const allowedStatuses = new Set(['active', 'held']);
    if (ticket.status && !allowedStatuses.has(String(ticket.status).toLowerCase())) {
      return NextResponse.json(
        { error: `Ticket no disponible (estado: ${ticket.status})` },
        { status: 409 }
      );
    }

    const { data: event, error: eventErr } = await sb
      .from('events')
      .select('*')
      .eq('id', ticket.event_id)
      .single();

    if (eventErr || !event) {
      return NextResponse.json({ error: 'Evento no encontrado' }, { status: 404 });
    }

    const sellerId = ticket.seller_id ?? ticket.owner_id ?? ticket.user_id ?? null;

    let seller = null;
    if (sellerId) {
      const { data: sellerRow } = await sb
        .from('profiles')
        .select('id, full_name, email')
        .eq('id', sellerId)
        .single();
      seller = sellerRow ?? null;
    }

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
          .select('id, full_name, email')
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
        rater: ratersById[r.rater_id] ?? { id: r.rater_id, full_name: 'Usuario', email: null },
      }));
    }

    const price = Number(ticket.price ?? ticket.price_clp ?? 0);
    
    // Obtener rol del vendedor para calcular fee dinámico
    let sellerRole = 'basic';
    if (sellerId) {
      const { data: sellerProfile } = await sb
        .from('profiles')
        .select('role')
        .eq('id', sellerId)
        .single();
      sellerRole = sellerProfile?.role ?? 'basic';
    }
    
    // Calcular fee basado en rol del vendedor
    const fees = calculateFees(price, sellerRole);

    const eventTitle = event.title || event.name || 'Evento';
    const eventStartsAt = normalizeEventStartsAt(event);

    return NextResponse.json({
      ticket: {
        id: ticket.id,
        event_id: ticket.event_id,
        seller_id: sellerId,
        section: ticket.section,
        row: ticket.row,
        seat: ticket.seat,
        notes: ticket.notes,
        original_price: ticket.original_price,
        price,
        currency: 'CLP',
        status: ticket.status,
      },
      event: {
        id: event.id,
        title: eventTitle,
        venue: event.venue,
        city: event.city,
        country: event.country,
        starts_at: eventStartsAt,
        image_url: event.image_url ?? null,
      },
      seller,
      sellerStats,
      sellerRatings,
      fees,
    });
  } catch (err) {
    console.error('checkout/preview error', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

