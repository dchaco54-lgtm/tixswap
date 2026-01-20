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
  const token = requestUrl.searchParams.get('token'); // Implicit flow fallback
  const type = requestUrl.searchParams.get('type');
  const redirectTo = requestUrl.searchParams.get('redirectTo') || '/dashboard';
  const origin = process.env.NEXT_PUBLIC_APP_URL || requestUrl.origin;

  console.log('[AuthCallback] Iniciando callback:', {
    code: code ? `${code.substring(0, 20)}...` : 'null',
    token: token ? `${token.substring(0, 20)}...` : 'null',
    type,
    redirectTo,
    origin,
    timestamp: new Date().toISOString(),
  });

  // ============================================
  // 1. VALIDAR CODE O TOKEN
  // ============================================
  if (!code && !token) {
    console.warn('[AuthCallback] No code ni token en URL');
    return NextResponse.redirect(
      new URL(`/login?error=no_code&message=${encodeURIComponent('Link de confirmación inválido. Verifica que hayas usado el link completo del email.')}`, origin)
    );
  }

  try {
    // ============================================
    // 2. CREAR CLIENTE SUPABASE CON COOKIES
    // ============================================
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

    // ============================================
    // 3. INTERCAMBIAR CODE/TOKEN POR SESIÓN
    // ============================================
    
    let sessionData;
    
    if (code) {
      // PKCE flow (preferred)
      console.log('[AuthCallback] Usando PKCE flow con code...');
      
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

      if (!data?.session) {
        console.warn('[AuthCallback] No session después del exchange');
        return NextResponse.redirect(
          new URL(`/login?error=no_session&message=${encodeURIComponent('No se pudo establecer la sesión')}`, origin)
        );
      }
      
      sessionData = data;
    } else if (token && type) {
      // Implicit flow fallback (deprecated pero soportado)
      console.log('[AuthCallback] Usando implicit flow con token (deprecated)...');
      
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        token_hash: token,
        type: type as any,
      });

      if (verifyError) {
        console.error('[AuthCallback] Error en verifyOtp:', verifyError);
        return NextResponse.redirect(
          new URL(`/login?error=auth_error&message=${encodeURIComponent('Token inválido o expirado')}`, origin)
        );
      }

      if (!data?.session) {
        console.warn('[AuthCallback] No session después de verifyOtp');
        return NextResponse.redirect(
          new URL(`/login?error=no_session&message=${encodeURIComponent('No se pudo establecer la sesión')}`, origin)
        );
      }
      
      sessionData = data;
    }

    // ============================================
    // 4. VERIFICAR SESIÓN ACTUAL
    // ============================================
    const { data: currentSessionData } = await supabase.auth.getSession();
    
    if (!currentSessionData?.session) {
      console.warn('[AuthCallback] No session activa después de exchange');
      return NextResponse.redirect(
        new URL(`/login?error=no_session&message=${encodeURIComponent('No se pudo establecer la sesión')}`, origin)
      );
    }

    const user = currentSessionData.session.user;

    console.log('[AuthCallback] ✓ Sesión establecida:', {
      userId: user.id,
      email: user.email,
      emailConfirmed: user.email_confirmed_at ? 'sí' : 'no',
    });

    // ============================================
    // 5. CREAR/ACTUALIZAR PROFILE (IMPORTANTE)
    // ============================================
    // Si el usuario no tiene profile, crear uno automáticamente
    try {
      const { data: existingProfile, error: fetchError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        // PGRST116 = no rows found (es normal)
        console.error('[AuthCallback] Error verificando profile:', fetchError);
      }

      if (!existingProfile) {
        // Profile no existe, crear uno
        const { error: createError } = await supabase.from('profiles').insert([
          {
            id: user.id,
            email: user.email,
            full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Usuario',
            rut: user.user_metadata?.rut || null,
            phone: user.user_metadata?.phone || null,
            user_type: user.user_metadata?.user_type || 'user',
            seller_tier: user.user_metadata?.seller_tier || 'free',
            email_confirmed: true,
            onboarding_completed: false,
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
    // 6. REDIRIGIR A DESTINO FINAL (preservando cookies)
    // ============================================
    console.log('[AuthCallback] Redirigiendo a:', redirectTo);

    const redirectUrl = new URL(redirectTo, origin);
    redirectUrl.searchParams.set('confirmed', 'true');

    // Crear respuesta que preserve las cookies de Supabase
    const response = NextResponse.redirect(redirectUrl);
    return response;

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
