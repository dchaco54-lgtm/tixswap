import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Endpoint para marcar onboarding como completado (permanente)
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 });
    }

    const supabase = createRouteHandlerClient({ cookies });

    // Verificar que el usuario esté logueado
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session || session.user.id !== userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Actualizar onboarding como completado
    const { error } = await supabase
      .from('profiles')
      .update({
        onboarding_completed: true,
        onboarding_completed_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (error) {
      console.error('[Onboarding Complete] Error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log('[Onboarding Complete] ✓ Marcado como completado');
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[Onboarding Complete] Unexpected error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic';
