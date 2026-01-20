import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Endpoint para dismissir onboarding modal (rate limit 24h)
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

    // Actualizar onboarding_dismissed_at
    const { error } = await supabase
      .from('profiles')
      .update({
        onboarding_dismissed_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (error) {
      console.error('[Onboarding Dismiss] Error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log('[Onboarding Dismiss] ✓ Rate limit set para 24h');
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[Onboarding Dismiss] Unexpected error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic';
