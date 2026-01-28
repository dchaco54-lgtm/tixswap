export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { calculateSellerFee, calculateSellerPayout } from '@/lib/fees';
import { detectTicketColumns } from '@/lib/db/ticketSchema';

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
    const { eventId, sector, fila, asiento, price, ticketUploadId } = body || {};

    console.log('[Publish] Payload recibido:', { eventId, price, sector, fila, asiento, sellerId });

    // Obtener perfil del usuario con su rol
    const { data: profile, error: profErr } = await supabase
      .from('profiles')
      .select('full_name, email, user_type, seller_tier')
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

    let upload = null;
    if (ticketUploadId) {
      const { data: uploadRow, error: uploadErr } = await supabase
        .from('ticket_uploads')
        .select(
          'id,seller_id,is_nominated,is_nominada,storage_bucket,storage_path,original_name,mime_type,file_size,validation_status,validation_reason,provider,status'
        )
        .eq('id', ticketUploadId)
        .maybeSingle();

      if (uploadErr) {
        return NextResponse.json({ error: uploadErr.message }, { status: 500 });
      }

      if (!uploadRow || uploadRow.seller_id !== sellerId) {
        return NextResponse.json({ error: 'ticketUploadId inválido' }, { status: 400 });
      }

      const validStatuses = new Set(['uploaded', 'validated', 'approved', 'valid']);
      if (uploadRow.status && !validStatuses.has(uploadRow.status)) {
        return NextResponse.json(
          { error: 'ticketUploadId inválido', details: 'Estado de upload no válido' },
          { status: 400 }
        );
      }
      if (uploadRow.validation_status && !validStatuses.has(uploadRow.validation_status)) {
        return NextResponse.json(
          { error: 'ticketUploadId inválido', details: 'Validación no aprobada' },
          { status: 400 }
        );
      }

      upload = uploadRow;
    }

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

    if (upload) {
      const columns = await detectTicketColumns(supabase);

      if (columns.has('ticket_upload_id')) insertPayload.ticket_upload_id = ticketUploadId;
      if (columns.has('upload_bucket')) insertPayload.upload_bucket = upload.storage_bucket ?? null;
      if (columns.has('upload_path')) insertPayload.upload_path = upload.storage_path ?? null;

      const nominated = upload.is_nominated ?? upload.is_nominada ?? false;
      if (columns.has('is_nominated')) insertPayload.is_nominated = nominated;
      if (columns.has('is_nominada')) insertPayload.is_nominada = nominated;
    }

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
