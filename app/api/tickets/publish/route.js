export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { calculateSellerFee, calculateSellerPayout } from '@/lib/fees';

export async function POST(request) {
  try {
    // Obtener token del header (nunca confiar en userId del body)
    const authHeader = request.headers.get('authorization') || '';
    const token = authHeader.replace('Bearer ', '').trim();

    if (!token) {
      return NextResponse.json({ error: 'No autorizado - falta token' }, { status: 401 });
    }

    const supabase = supabaseAdmin();

    // Verificar que el token es válido y obtener el usuario
    const { data: authUser, error: authErr } = await supabase.auth.getUser(token);
    
    console.log('[Publish] Auth check:', { hasUser: !!authUser?.user, userId: authUser?.user?.id, error: authErr?.message });
    
    if (authErr || !authUser?.user) {
      return NextResponse.json({ error: 'Usuario no válido' }, { status: 401 });
    }

    const user = authUser.user;
    const sellerId = user.id; // ✅ Confiamos en el token, no en el body

    // Ahora leemos el body (sin userId)
    const body = await request.json();
    const { eventId, sector, fila, asiento, price } = body || {};

    console.log('[Publish] Payload recibido:', { eventId, price, sector, fila, asiento, sellerId });

    // Obtener perfil del usuario con su rol
    const { data: profile, error: profErr } = await supabase
      .from('profiles')
      .select('full_name, email, user_type')
      .eq('id', sellerId)
      .maybeSingle();

    if (profErr) {
      return NextResponse.json({ error: profErr.message }, { status: 500 });
    }

    const userRole = profile?.user_type || 'standard'; // default: standard

    // Calcular fee del vendedor según su tipo usando los helpers
    const originalPrice = Number(price);
    const platformFee = calculateSellerFee(originalPrice, userRole);
    const sellerPayout = calculateSellerPayout(originalPrice, userRole);

    console.log('[Publish] Cálculo de fees:', {
      userRole,
      originalPrice,
      platformFee,
      sellerPayout,
      isFreeOrAdmin: userRole === 'free' || userRole === 'admin'
    });

    const insertPayload = {
      event_id: eventId,
      seller_id: sellerId,
      seller_name: profile?.full_name || user.email || 'Vendedor',
      seller_email: profile?.email || user.email || null,
      price: originalPrice,
      original_price: originalPrice,
      platform_fee: platformFee,
      status: 'active',
      sale_type: 'fixed',

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

    // ✅ Revalidar la página del evento usando On-Demand Revalidation
    try {
      // Revalidate the specific event page
      await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'https://tixswap.cl'}/api/revalidate?path=/events/${eventId}&secret=${process.env.REVALIDATE_SECRET || 'dev-secret'}`, {
        method: 'POST'
      });
      console.log('[Publish] Página revalidada:', `/events/${eventId}`);
    } catch (revalErr) {
      console.warn('[Publish] Error revalidando:', revalErr);
      // No bloqueamos si falla
    }

    return NextResponse.json({ ok: true, ticket: created });
  } catch (e) {
    return NextResponse.json({ error: e?.message || 'Error inesperado' }, { status: 500 });
  }
}

