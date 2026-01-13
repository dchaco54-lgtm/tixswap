import { NextResponse } from 'next/server';
import { supabaseReadServer } from '@/lib/supabaseReadServer';

export async function POST(request) {
  try {
    const body = await request.json();
    const { eventId, sector, fila, asiento, price } = body || {};

    if (!eventId || !price) {
      return NextResponse.json(
        { error: 'Faltan datos: eventId y price son requeridos.' },
        { status: 400 }
      );
    }

    const supabase = supabaseReadServer();

    const { data: auth, error: authErr } = await supabase.auth.getUser();
    if (authErr || !auth?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    // seller profile
    const sellerId = auth.user.id;

    const { data: profile, error: profErr } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', sellerId)
      .maybeSingle();

    if (profErr) {
      return NextResponse.json({ error: profErr.message }, { status: 500 });
    }

    const insertPayload = {
      event_id: eventId,
      seller_id: sellerId,
      seller_name: profile?.full_name || auth.user.email || 'Vendedor',
      seller_email: profile?.email || auth.user.email || null,
      price: Number(price),
      status: 'active',

      // ✅ Estas columnas EXISTEN en tu schema -> insert directo (sin columnExists)
      sector: sector || null,
      row_label: fila || null,
      seat_label: asiento || null,
    };

    const { data: created, error: insertErr } = await supabase
      .from('tickets')
      .insert(insertPayload)
      .select('*')
      .single();

    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, ticket: created });
  } catch (e) {
    return NextResponse.json({ error: e?.message || 'Error inesperado' }, { status: 500 });
  }
}

