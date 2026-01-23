export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { buildTicketSelect, detectTicketColumns, normalizeTicket } from '@/lib/db/ticketSchema';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseServiceKey) {
	throw new Error('Missing Supabase env vars');
}
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
	auth: { persistSession: false },
});

// GET /api/tickets/my-publications?status=...&q=...&sort=...
// Alias: este endpoint reusa la lógica de my-listings para robustez y shape único

export async function GET(request) {
	try {
		// Auth con bearer token
		const authHeader = request.headers.get('authorization');
		if (!authHeader?.startsWith('Bearer ')) {
			return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
		}

		const token = authHeader.replace('Bearer ', '');
		const { data: authData, error: authErr } = await supabaseAdmin.auth.getUser(token);
		if (authErr || !authData?.user) {
			return NextResponse.json({ error: 'Sesión inválida' }, { status: 401 });
		}

		const userId = authData.user.id;

		// Detectar columnas y armar select robusto
		const columns = await detectTicketColumns(supabaseAdmin);
		const selectStr = buildTicketSelect(columns);
		const { data: tickets, error: ticketsErr } = await supabaseAdmin
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
	} catch (err) {
		return NextResponse.json({ error: 'Error inesperado', details: err?.message, stack: err?.stack }, { status: 500 });
	}
}
