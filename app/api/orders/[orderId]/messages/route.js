import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function getUserFromToken(req) {
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  
  if (!token) return null;

  const admin = supabaseAdmin();
  try {
    const { data, error } = await admin.auth.getUser(token);
    if (error || !data?.user) return null;
    return data.user;
  } catch {
    return null;
  }
}

// GET: Obtener mensajes de una orden
export async function GET(req, { params }) {
  try {
    const orderId = params.orderId;
    const user = await getUserFromToken(req);

    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const admin = supabaseAdmin();


    // Verificar que el usuario sea parte de la orden y obtener buyer/seller info
    const { data: order, error: orderError } = await admin
      .from('orders')
      .select('id, buyer_id, seller_id')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 });
    }

    if (order.buyer_id !== user.id && order.seller_id !== user.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    // Traer buyer_name, buyer_rut, seller_name, seller_rut
    let buyer_name = null, buyer_rut = null, seller_name = null, seller_rut = null;
    try {
      const ids = [order.buyer_id, order.seller_id].filter(Boolean);
      if (ids.length) {
        const { data: profiles, error: profErr } = await admin
          .from('profiles')
          .select('id, full_name, rut')
          .in('id', ids);
        if (profErr) {
          console.error('GET /api/orders/[orderId]/messages profile join error', profErr);
        }
        if (profiles) {
          for (const p of profiles) {
            if (p.id === order.buyer_id) {
              buyer_name = p.full_name || null;
              buyer_rut = p.rut || null;
            }
            if (p.id === order.seller_id) {
              seller_name = p.full_name || null;
              seller_rut = p.rut || null;
            }
          }
        }
      }
    } catch (e) {
      console.error('GET /api/orders/[orderId]/messages profile join exception', e);
    }

    // Obtener mensajes con info del sender
    const { data: messages, error: messagesError } = await admin
      .from('order_messages')
      .select(`
        id,
        message,
        attachment_url,
        attachment_name,
        created_at,
        sender_id
      `)
      .eq('order_id', orderId)
      .order('created_at', { ascending: true });

    if (messagesError) {
      console.error('Error loading messages:', messagesError);
      return NextResponse.json({ error: 'Error cargando mensajes' }, { status: 500 });
    }

    // Obtener info de los senders
    const senderIds = [...new Set((messages || []).map(m => m.sender_id))];
    const sendersById = {};

    if (senderIds.length > 0) {
      const { data: profiles } = await admin
        .from('profiles')
        .select('id, full_name, email')
        .in('id', senderIds);

      (profiles || []).forEach(p => {
        sendersById[p.id] = p;
      });
    }

    const enriched = (messages || []).map(m => ({
      ...m,
      sender: sendersById[m.sender_id] || { id: m.sender_id, full_name: 'Usuario', email: null },
      is_mine: m.sender_id === user.id,
    }));

    return NextResponse.json({
      messages: enriched,
      buyer_name,
      buyer_rut,
      seller_name,
      seller_rut,
    });
  } catch (err) {
    console.error('GET /api/orders/[orderId]/messages error:', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

// POST: Crear nuevo mensaje
export async function POST(req, { params }) {
  try {
    const orderId = params.orderId;
    const user = await getUserFromToken(req);

    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { message, attachment_url, attachment_name } = body;

    if (!message || !message.trim()) {
      return NextResponse.json({ error: 'Mensaje requerido' }, { status: 400 });
    }

    const admin = supabaseAdmin();

    // Verificar acceso a la orden
    const { data: order, error: orderError } = await admin
      .from('orders')
      .select('id, buyer_id, seller_id')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 });
    }

    if (order.buyer_id !== user.id && order.seller_id !== user.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    // Crear mensaje
    const { data: newMessage, error: insertError } = await admin
      .from('order_messages')
      .insert({
        order_id: orderId,
        sender_id: user.id,
        message: message.trim(),
        attachment_url: attachment_url || null,
        attachment_name: attachment_name || null,
      })
      .select('id, message, attachment_url, attachment_name, created_at, sender_id')
      .single();

    if (insertError) {
      console.error('Error creating message:', insertError);
      return NextResponse.json({ error: 'Error creando mensaje' }, { status: 500 });
    }

    return NextResponse.json({ message: newMessage }, { status: 201 });
  } catch (err) {
    console.error('POST /api/orders/[orderId]/messages error:', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
