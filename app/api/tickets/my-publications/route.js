export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';

// GET /api/tickets/my-publications?status=...&q=...&sort=...
// Alias: este endpoint reusa la lógica de my-listings para robustez y shape único
import { buildTicketSelect, detectTicketColumns, normalizeTicket } from '@/lib/db/ticketSchema';

export async function GET(request) {
	// 1. Intentar obtener userId por cookie (session)
	const supabase = createClient();
	let userId = null;
	let token = null;

	// Next.js App Router: cookies ya están en el contexto
	const { data: { user }, error: userError } = await supabase.auth.getUser();
	if (user && !userError) {
		userId = user.id;
	}

	// 2. Si no hay userId, intentar por header Authorization
	if (!userId) {
		const authHeader = request.headers.get('authorization');
		if (authHeader?.startsWith('Bearer ')) {
			token = authHeader.replace('Bearer ', '');
			const { data: authData, error: authErr } = await supabase.auth.getUser(token);
			if (authData?.user && !authErr) {
				userId = authData.user.id;
			}
		}
	}

	if (!userId) {
		return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
	}

	// 3. Detectar columnas y armar select robusto
	const columns = await detectTicketColumns(supabase);
	const selectStr = buildTicketSelect(columns);
	const { data: tickets, error: ticketsErr } = await supabase
		.from('tickets')
		.select(selectStr)
		.eq('seller_id', userId)
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
}
