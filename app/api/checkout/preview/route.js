import { NextResponse } from 'next/server';
import { supabaseServiceOptional } from '@/lib/supabaseServiceOptional';
import { supabaseReadServer } from '@/lib/supabaseReadServer';
import { calculateFees } from '@/lib/fees';

function getSupabase() {
  // Prefer service role (avoids RLS issues), fallback to authenticated/anon server client
  return supabaseServiceOptional() ?? supabaseReadServer();
}

async function getSellerWithRatings(supabase, sellerId, fallbackName) {
  // Seller basic info
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, tier')
    .eq('id', sellerId)
    .maybeSingle();

  const name = profile?.full_name || fallbackName || 'Vendedor';

  // Ratings list (no embedded join assumptions)
  const { data: ratings, error: rErr } = await supabase
    .from('ratings')
    .select('stars, comment, created_at, rater_id')
    .eq('target_id', sellerId)
    .order('created_at', { ascending: false })
    .limit(10);

  if (rErr) {
    return {
      id: sellerId,
      name,
      tier: profile?.tier ?? null,
      rating_avg: null,
      rating_count: 0,
      recent_ratings: [],
    };
  }

  const safeRatings = (ratings || []).filter((r) => r && r.stars != null);

  const rating_count = safeRatings.length;
  const rating_avg =
    rating_count > 0
      ? safeRatings.reduce((acc, r) => acc + Number(r.stars || 0), 0) / rating_count
      : null;

  // Fetch rater names (separate query, robust)
  const raterIds = [...new Set(safeRatings.map((r) => r.rater_id).filter(Boolean))];
  let raterMap = {};
  if (raterIds.length) {
    const { data: raters } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', raterIds);

    (raters || []).forEach((p) => {
      raterMap[p.id] = p.full_name || 'Usuario';
    });
  }

  const recent_ratings = safeRatings.map((r) => ({
    stars: Number(r.stars || 0),
    comment: r.comment || '',
    created_at: r.created_at,
    rater_id: r.rater_id,
    rater_name: raterMap[r.rater_id] || 'Usuario',
  }));

  return {
    id: sellerId,
    name,
    tier: profile?.tier ?? null,
    rating_avg,
    rating_count,
    recent_ratings,
  };
}

export async function POST(req) {
  try {
    const { ticketId } = await req.json();

    if (!ticketId) {
      return NextResponse.json({ error: 'ticketId es requerido' }, { status: 400 });
    }

    const supabase = getSupabase();

    // 1) Ticket (sin embeds)
    const { data: ticket, error: tErr } = await supabase
      .from('tickets')
      .select(
        'id, title, description, sector, row_label, seat_label, price, status, event_id, seller_id, seller_name'
      )
      .eq('id', ticketId)
      .maybeSingle();

    if (tErr) return NextResponse.json({ error: tErr.message }, { status: 500 });
    if (!ticket) return NextResponse.json({ error: 'Ticket no encontrado' }, { status: 404 });

    if (ticket.status !== 'active') {
      return NextResponse.json({ error: 'Ticket no disponible' }, { status: 409 });
    }

    // 2) Evento (sin embeds)
    const { data: event, error: eErr } = await supabase
      .from('events')
      .select('id, title, date, time, venue, city, image_url')
      .eq('id', ticket.event_id)
      .maybeSingle();

    if (eErr) return NextResponse.json({ error: eErr.message }, { status: 500 });

    // 3) Seller + ratings
    const seller = await getSellerWithRatings(
      supabase,
      ticket.seller_id,
      ticket.seller_name
    );

    // 4) Fees (2.5% con mínimo 1200)
    const fees = calculateFees(Number(ticket.price || 0));

    return NextResponse.json({
      ticket: {
        id: ticket.id,
        title: ticket.title,
        description: ticket.description,
        sector: ticket.sector,
        row_label: ticket.row_label,
        seat_label: ticket.seat_label,
        price: Number(ticket.price || 0),
      },
      event: event || null,
      seller,
      fees,
      totals: {
        subtotal: Number(ticket.price || 0),
        fee: fees.platformFee,
        total: Number(ticket.price || 0) + fees.platformFee,
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e?.message || 'Error inesperado en preview' },
      { status: 500 }
    );
  }
}
