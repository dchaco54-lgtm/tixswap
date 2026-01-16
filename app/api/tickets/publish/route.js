export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { calculateFees } from '@/lib/fees';

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
    const sellerId = user.id;

    // Obtener perfil del usuario con su rol
    const { data: profile, error: profErr } = await supabase
      .from('profiles')
      .select('full_name, email, role')
      .eq('id', sellerId)
      .maybeSingle();

    if (profErr) {
      return NextResponse.json({ error: profErr.message }, { status: 500 });
    }

    const userRole = profile?.role || 'basic'; // default: basic (usuario nuevo)

    // Calcular fee según el rol del usuario
    let platformFee = 0;
    const originalPrice = Number(price);

    if (userRole === 'free') {
      // Usuario FREE: sin comisión
      platformFee = 0;
      console.log('[Publish] Usuario FREE - Sin comisión');
    } else if (userRole === 'admin') {
      // Admin: sin comisión
      platformFee = 0;
      console.log('[Publish] Usuario ADMIN - Sin comisión');
    } else {
      // Usuario básico: 2.5% con mínimo $1.200
      const fees = calculateFees(originalPrice);
      platformFee = fees.platformFee;
      console.log('[Publish] Usuario básico - Fee:', platformFee, '(2.5% con mínimo $1.200)');
    }

    const insertPayload = {
      event_id: eventId,
      seller_id: sellerId,
      seller_name: profile?.full_name || user.email || 'Vendedor',
      seller_email: profile?.email || user.email || null,
      price: originalPrice,
      original_price: originalPrice, // ✅ Guardar precio original
      platform_fee: platformFee,     // ✅ Guardar comisión calculada
      status: 'active',
      sale_type: 'fixed', // Tipo de venta fijo (vs subasta, etc)
    const { data: created, error: insertErr } = await supabase
      .from('tickets')
      .insert(insertPayload)
      .select('*')
      .single();
    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    // ✅ Revalidar la página del evento directamente
    try {
      revalidatePath(`/events/${eventId}`, 'page');
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
