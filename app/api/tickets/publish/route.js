export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(request) {
  try {
    const body = await request.json();
    const { eventId, sector, fila, asiento, price, userId, userEmail } = body || {};

    console.log('[Publish] Payload recibido:', { eventId, price, sector, fila, asiento, userId });

    if (!eventId || !price) {
      return NextResponse.json(
        { error: 'Faltan datos: eventId y price son requeridos.' },
        { status: 400 }
      );
    }

    if (!userId) {
      return NextResponse.json({ error: 'No autenticado - falta userId' }, { status: 401 });
    }

    const supabase = supabaseAdmin();

    // Verificar que el usuario existe
    const { data: authUser, error: authErr } = await supabase.auth.admin.getUserById(userId);
    
    console.log('[Publish] Auth check:', { hasUser: !!authUser, userId: authUser?.user?.id, error: authErr?.message });
    
    if (authErr || !authUser?.user) {
      return NextResponse.json({ error: 'Usuario no válido' }, { status: 401 });
    }

    const user = authUser.user;

    // seller profile
    const sellerId = user.id;

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
      seller_name: profile?.full_name || user.email || 'Vendedor',
      seller_email: profile?.email || user.email || null,
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

