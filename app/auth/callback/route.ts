import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { syncProfileFromAuthUser } from '@/lib/profileCompletionServer';

/**
 * Auth Callback Route Handler
 * 
 * Este endpoint procesa la confirmación de email desde Supabase.
 * Flujo:
 * 1. Usuario recibe email con link: /auth/callback?token_hash=xxx&type=email
 * 2. Route handler verifica el token hash o intercambia el code por sesión
 * 3. Sesión se guarda en cookies (SSR-friendly)
 * 4. Redirige a redirectTo o /dashboard
 */

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const tokenHash =
    requestUrl.searchParams.get('token_hash') ||
    requestUrl.searchParams.get('token');
  const type = requestUrl.searchParams.get('type');
  const redirectToParam =
    requestUrl.searchParams.get('redirectTo') ||
    requestUrl.searchParams.get('redirect_to') ||
    requestUrl.searchParams.get('next') ||
    '/dashboard';
  const redirectTo = redirectToParam.startsWith('/') ? redirectToParam : '/dashboard';
  const origin = (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    requestUrl.origin
  ).replace(/\/+$/, "");

  console.log('[AuthCallback] Iniciando callback:', {
    code: code ? `${code.substring(0, 20)}...` : 'null',
    tokenHash: tokenHash ? `${tokenHash.substring(0, 20)}...` : 'null',
    type,
    redirectTo,
    origin,
    timestamp: new Date().toISOString(),
  });

  // ============================================
  // 1. VALIDAR CODE O TOKEN_HASH
  // ============================================
  if (!code && !tokenHash) {
    console.warn('[AuthCallback] No code ni token_hash en URL');
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
    // 3. INTERCAMBIAR CODE O VERIFICAR TOKEN_HASH
    // ============================================
    
    type OtpType =
      | "email"
      | "signup"
      | "invite"
      | "magiclink"
      | "recovery"
      | "email_change";

    const otpType = (type || 'email') as OtpType;
    
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

        // Compat: rescata links antiguos/mal configurados donde TokenHash llegó en `code`.
        console.log('[AuthCallback] Reintentando con verifyOtp usando code como token_hash...');

        const { data: otpData, error: verifyError } = await supabase.auth.verifyOtp({
          token_hash: code,
          type: otpType,
        });

        if (verifyError) {
          console.error('[AuthCallback] Error en verifyOtp fallback:', verifyError);

          const errorMessages: { [key: string]: string } = {
            invalid_code: 'El link de confirmación expiró o ya fue usado',
            access_denied: 'Acceso denegado. Intenta registrarte de nuevo',
            server_error: 'Error del servidor. Intenta más tarde',
          };

          const message =
            errorMessages[exchangeError.message] ||
            verifyError.message ||
            exchangeError.message ||
            'Error al confirmar el correo';

          return NextResponse.redirect(
            new URL(`/login?error=auth_error&message=${encodeURIComponent(message)}`, origin)
          );
        }

        if (!otpData?.session) {
          console.warn('[AuthCallback] No session después de verifyOtp fallback');
          return NextResponse.redirect(
            new URL(`/login?error=no_session&message=${encodeURIComponent('No se pudo establecer la sesión')}`, origin)
          );
        }
      }

      if (!data?.session && !exchangeError) {
        console.warn('[AuthCallback] No session después del exchange');
        return NextResponse.redirect(
          new URL(`/login?error=no_session&message=${encodeURIComponent('No se pudo establecer la sesión')}`, origin)
        );
      }
      
    } else if (tokenHash) {
      // SSR/email flow actual recomendado por Supabase
      console.log('[AuthCallback] Usando verifyOtp con token_hash...');
      
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: otpType,
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
      const admin = supabaseAdmin();
      await syncProfileFromAuthUser(admin, user);
      console.log('[AuthCallback] ✓ Perfil sincronizado');
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
