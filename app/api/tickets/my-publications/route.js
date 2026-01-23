
export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { buildTicketSelect, detectTicketColumns, normalizeTicket } from '@/lib/db/ticketSchema';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

// GET /api/tickets/my-publications?status=...&q=...&sort=...
// Alias: este endpoint reusa la lógica de my-listings para robustez y shape único

export async function GET(request) {
	try {
		const supabase = createClient(cookies());
		const { data: { user }, error: userError } = await supabase.auth.getUser();
		if (userError || !user) {
			return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
		}
		const userId = user.id;

		// 1. Obtener el rut del usuario autenticado desde profiles
		const { data: profile, error: profileError } = await supabase
			.from('profiles')
			.select('rut')
			.eq('id', userId)
			.maybeSingle();
		if (profileError || !profile?.rut) {
			return NextResponse.json({ error: 'No se pudo obtener el RUT del usuario' }, { status: 500 });
		}
		const rut = profile.rut;

		// 2. Detectar columnas y armar select robusto
		let columns;
		try {
			columns = await detectTicketColumns();
		} catch (colErr) {
			return NextResponse.json({ error: 'Error al detectar columnas', details: colErr?.message }, { status: 500 });
		}
		const selectStr = buildTicketSelect(columns);
		// 3. Buscar tickets por seller_rut
		const { data: tickets, error: ticketsErr } = await supabase
			.from('tickets')
			.select(selectStr)
			.eq('seller_rut', rut)
			.order('created_at', { ascending: false })
			.limit(100);

		if (ticketsErr) {
			return NextResponse.json({ error: 'Error al obtener publicaciones', details: ticketsErr.message }, { status: 500 });
		}

		// Normalizar tickets
		const normTickets = (tickets || []).map(normalizeTicket);
		// Calcular contadores
		const active = normTickets.filter((t) => t.status === 'active' || t.status === 'available').length;
		const paused = normTickets.filter((t) => t.status === 'paused').length;
		const sold = normTickets.filter((t) => t.status === 'sold').length;

		return NextResponse.json({
			tickets: normTickets,
			summary: {
				total: normTickets.length,
				active,
				paused,
				sold,
			},
		});
	} catch (err) {
		console.error('Error en GET /api/tickets/my-publications:', err);
		return NextResponse.json({ error: 'Error inesperado', details: err?.message, stack: err?.stack }, { status: 500 });
	}
}
