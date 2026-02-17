export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { calculateSellerFee, calculateSellerPayout } from '@/lib/fees';
import { detectTicketColumns } from '@/lib/db/ticketSchema';
import { sendEmail } from '@/lib/email/resend';
import { templateTicketPublished, templateEventNewTicketAlert } from '@/lib/email/templates';
import { createNotification } from '@/lib/notifications';

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

    let eventName = null;
    let eventVenue = null;
    let eventCity = null;

    if (eventId) {
      const { data: eventRow, error: eventErr } = await supabase
        .from('events')
        .select('title,venue,city')
        .eq('id', eventId)
        .maybeSingle();

      if (eventErr) {
        console.warn('[Publish] Error cargando evento:', eventErr);
      }

      eventName = eventRow?.title || null;
      eventVenue = eventRow?.venue || null;
      eventCity = eventRow?.city || null;
    }

    // ✅ Email al vendedor (no bloquea)
    try {
      const sellerEmail = profile?.email || user.email;
      if (sellerEmail) {
        const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://tixswap.cl').replace(/\/+$/, '');
        const link = `${baseUrl}/dashboard/publications/${created.id}`;

        const { subject, html } = templateTicketPublished({
          sellerName: profile?.full_name || null,
          ticketId: created.id,
          eventName,
          price: created.price,
          link,
          sector: created.sector || sector || null,
          sectionLabel: created.section_label || null,
          rowLabel: created.row_label || fila || null,
          seatLabel: created.seat_label || asiento || null,
        });

        const mailRes = await sendEmail({ to: sellerEmail, subject, html });
        if (!mailRes.ok && !mailRes.skipped) {
          console.warn('[Publish] Error enviando mail:', mailRes.error);
        }
      }
    } catch (mailErr) {
      console.warn('[Publish] Error enviando mail:', mailErr);
    }

    await createNotification({
      userId: sellerId,
      type: 'system',
      title: 'Publicación creada',
      body: 'Tu entrada quedó publicada.',
      link: `/dashboard/publications/${created.id}`,
      metadata: { ticketId: created.id, eventId },
    });

    // ✅ Alertas a suscriptores del evento (no bloquea)
    try {
      if (eventId) {
        const { data: subs, error: subsErr } = await supabase
          .from('event_alert_subscriptions')
          .select('user_id')
          .eq('event_id', eventId);

        if (subsErr) {
          console.warn('[Publish] Error cargando suscriptores:', subsErr);
        } else {
          const subscriberIds = (subs || [])
            .map((s) => s.user_id)
            .filter(Boolean)
            .filter((uid) => uid !== sellerId);

          if (subscriberIds.length) {
            const { data: profiles, error: profErr } = await supabase
              .from('profiles')
              .select('id,full_name,email')
              .in('id', subscriberIds);

            if (profErr) {
              console.warn('[Publish] Error cargando perfiles suscriptores:', profErr);
            }

            const byId = new Map((profiles || []).map((p) => [p.id, p]));
            const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://tixswap.cl').replace(/\/+$/, '');
            const eventLink = `${baseUrl}/events/${eventId}`;
            const notifBody = eventName
              ? `Se publicaron nuevas entradas para ${eventName}`
              : 'Se publicaron nuevas entradas para un evento que sigues';

            await Promise.all(
              subscriberIds.map(async (userId) => {
                await createNotification({
                  userId,
                  type: 'event_new_ticket',
                  title: 'Nuevas entradas publicadas',
                  body: notifBody,
                  link: `/events/${eventId}`,
                  metadata: { eventId, ticketId: created.id },
                });

                const prof = byId.get(userId);
                const email = prof?.email || null;
                if (!email) return;

                const { subject, html } = templateEventNewTicketAlert({
                  recipientName: prof?.full_name || null,
                  eventName,
                  price: created.price,
                  link: eventLink,
                  sector: created.sector || sector || null,
                  sectionLabel: created.section_label || null,
                  rowLabel: created.row_label || fila || null,
                  seatLabel: created.seat_label || asiento || null,
                  venue: eventVenue,
                  city: eventCity,
                });

                const mailRes = await sendEmail({ to: email, subject, html });
                if (!mailRes.ok && !mailRes.skipped) {
                  console.warn('[Publish] Error enviando alerta mail:', mailRes.error);
                }
              })
            );
          }
        }
      }
    } catch (alertErr) {
      console.warn('[Publish] Error notificando suscriptores:', alertErr);
    }

    return NextResponse.json({ ok: true, ticket: created });
  } catch (e) {
    return NextResponse.json({ error: e?.message || 'Error inesperado' }, { status: 500 });
  }
}
