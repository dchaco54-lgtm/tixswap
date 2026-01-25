import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { calculateFees } from '@/lib/fees';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    const sb = supabaseAdmin();
    const body = await req.json();
    const { ticketId } = body;

    if (!ticketId) return NextResponse.json({ error: 'TicketId requerido' }, { status: 400 });

    // Ticket
    const { data: ticket, error: ticketErr } = await sb
      .from('tickets')
      .select('*')
      .eq('id', ticketId)
      .maybeSingle();

    if (ticketErr || !ticket) return NextResponse.json({ error: 'Ticket no encontrado' }, { status: 404 });

    const sellerId = ticket.seller_id || ticket.sellerId;

    // Precio - CLP
    const price = Number(ticket.price_clp ?? ticket.price ?? 0);

    // ✅ Fee correcto SIEMPRE: 2.5% con mínimo 1200
    const fees = calculateFees(price);

    return NextResponse.json({
      ticket: {
        id: ticket.id,
        price,
        status: ticket.status,
        seller_id: sellerId,
        event_id: ticket.event_id || ticket.eventId,
      },
      fees,
    });
  } catch (err) {
    console.error('checkout preview error', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

