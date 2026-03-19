import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

import { getMissingRequiredProfileFields } from '@/lib/profileCompletion';

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

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, full_name, rut, phone')
      .eq('id', userId)
      .maybeSingle();

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 });
    }

    const missingFields = getMissingRequiredProfileFields(profile);
    if (missingFields.length > 0) {
      return NextResponse.json(
        {
          error: 'PROFILE_INCOMPLETE',
          missing_fields: missingFields,
        },
        { status: 400 }
      );
    }

    // Actualizar onboarding como completado
    const { error } = await supabase
      .from('profiles')
      .update({
        onboarding_completed: true,
        onboarding_done: true,
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
