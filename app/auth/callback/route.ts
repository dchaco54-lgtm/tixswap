import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Auth Callback Route Handler (PKCE)
 * 
 * Este endpoint procesa la confirmación de email desde Supabase.
 * Flujo:
 * 1. Usuario recibe email con link: /auth/callback?code=xxx&redirectTo=/dashboard
 * 2. Route handler intercambia el code por sesión (PKCE)
 * 3. Sesión se guarda en cookies (SSR-friendly)
 * 4. Redirige a redirectTo o /dashboard
 */

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const redirectTo = requestUrl.searchParams.get('redirectTo') || '/dashboard';
  const origin = process.env.NEXT_PUBLIC_APP_URL || requestUrl.origin;

  console.log('[AuthCallback] Iniciando callback:', {
    code: code ? `${code.substring(0, 20)}...` : 'null',
    redirectTo,
    origin,
    timestamp: new Date().toISOString(),
  });

  // ============================================
  // 1. VALIDAR CODE
  // ============================================
  if (!code) {
    console.warn('[AuthCallback] No code en URL');
    return NextResponse.redirect(
      new URL(`/login?error=no_code&message=${encodeURIComponent('Link de confirmación inválido')}`, origin)
    );
  }

  try {
    // ============================================
    // 2. CREAR CLIENTE SUPABASE CON COOKIES
    // ============================================
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

    // ============================================
    // 3. INTERCAMBIAR CODE POR SESIÓN (PKCE)
    // ============================================
    console.log('[AuthCallback] Intercambiando code por sesión...');
    
    const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

    if (exchangeError) {
      console.error('[AuthCallback] Error en exchangeCodeForSession:', {
        message: exchangeError.message,
        status: exchangeError.status,
        name: exchangeError.name,
      });

      const errorMessages: { [key: string]: string } = {
        'invalid_code': 'El link de confirmación expiró o ya fue usado',
        'access_denied': 'Acceso denegado. Intenta registrarte de nuevo',
        'server_error': 'Error del servidor. Intenta más tarde',
      };

      const message = errorMessages[exchangeError.message] || exchangeError.message || 'Error al confirmar el correo';

      return NextResponse.redirect(
        new URL(`/login?error=auth_error&message=${encodeURIComponent(message)}`, origin)
      );
    }

    // ============================================
    // 4. VALIDAR SESIÓN
    // ============================================
    if (!data?.session) {
      console.warn('[AuthCallback] No session después del exchange');
      return NextResponse.redirect(
        new URL(`/login?error=no_session&message=${encodeURIComponent('No se pudo establecer la sesión')}`, origin)
      );
    }

    if (!data.user) {
      console.warn('[AuthCallback] No user en session');
      return NextResponse.redirect(
        new URL(`/login?error=no_user&message=${encodeURIComponent('Usuario no encontrado')}`, origin)
      );
    }

    console.log('[AuthCallback] ✓ Sesión establecida:', {
      userId: data.user.id,
      email: data.user.email,
      emailConfirmed: data.user.email_confirmed_at ? 'sí' : 'no',
    });

    // ============================================
    // 5. CREAR/ACTUALIZAR PROFILE (IMPORTANTE)
    // ============================================
    // Si el usuario no tiene profile, crear uno automáticamente
    try {
      const { data: existingProfile, error: fetchError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', data.user.id)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        // PGRST116 = no rows found (es normal)
        console.error('[AuthCallback] Error verificando profile:', fetchError);
      }

      if (!existingProfile) {
        // Profile no existe, crear uno
        const { error: createError } = await supabase.from('profiles').insert([
          {
            id: data.user.id,
            email: data.user.email,
            full_name: data.user.user_metadata?.full_name || '',
            rut: data.user.user_metadata?.rut || '',
            phone: data.user.user_metadata?.phone || '',
            user_type: data.user.user_metadata?.user_type || 'standard',
            seller_tier: data.user.user_metadata?.seller_tier || 'basic',
            email_confirmed: true,
            onboarding_completed: false,
            created_at: new Date().toISOString(),
          },
        ]);

        if (createError) {
          console.error('[AuthCallback] Error creando profile:', createError);
          // No es fatal, seguimos adelante
        } else {
          console.log('[AuthCallback] ✓ Profile creado automáticamente');
        }
      }
    } catch (err) {
      console.error('[AuthCallback] Error en profile setup:', err);
      // No es fatal, no bloqueamos el redirect
    }

    // ============================================
    // 6. REDIRIGIR A DESTINO FINAL
    // ============================================
    console.log('[AuthCallback] Redirigiendo a:', redirectTo);

    const redirectUrl = new URL(redirectTo, origin);
    redirectUrl.searchParams.set('confirmed', 'true');

    return NextResponse.redirect(redirectUrl);

  } catch (err) {
    console.error('[AuthCallback] Error inesperado:', {
      message: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });

    return NextResponse.redirect(
      new URL(
        `/login?error=unexpected&message=${encodeURIComponent('Error inesperado. Intenta iniciar sesión manualmente')}`,
        origin
      )
    );
  }
}

// Método POST para safety (prevenir prefetch issues)
export async function POST(request: NextRequest) {
  return GET(request);
}

// Prevenir cache
export const dynamic = 'force-dynamic';
