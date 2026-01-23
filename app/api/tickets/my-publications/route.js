import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';

// GET /api/tickets/my-publications?status=...&q=...&sort=...
export async function GET(req) {
  const supabase = createClient(cookies());
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');
  const q = searchParams.get('q');
  const sort = searchParams.get('sort');


  // Solo seleccionar columnas que existen (robusto a schema)
  // Si alguna columna no existe, no la selecciones
  // Para MVP, asume que currency, row_label, seat_label, section_label existen tras migración
  let query = supabase
    .from('tickets')
    .select(`
      id, created_at, status, price, currency,
      section_label, row_label, seat_label, is_named,
      event:events(id, title, starts_at, venue, city)
    `)
    .eq('seller_id', user.id);

  if (status && status !== 'all') {
    query = query.eq('status', status);
  }

  if (q) {
    query = query.ilike('events.title', `%${q}%`)
      .or(`events.venue.ilike.%${q}%,events.city.ilike.%${q}%`);
  }

  // Ordenamiento
  if (sort === 'price') {
    query = query.order('price', { ascending: false });
  } else if (sort === 'event_date') {
    query = query.order('events.starts_at', { ascending: true });
  } else {
    query = query.order('created_at', { ascending: false });
  }

  try {
    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ tickets: data });
  } catch (err) {
    console.error("[my-publications]", err);
    return NextResponse.json({ error: "No se pudo cargar tus publicaciones. Intenta de nuevo." }, { status: 500 });
  }
}
