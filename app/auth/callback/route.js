/**
 * Auth Callback Route Handler (PKCE)
 * 
 * Este route handler procesa el callback de confirmación de email y login.
 * Usa PKCE (Proof Key for Code Exchange) para intercambiar el código por una sesión.
 * 
 * Flujo:
 * 1. Usuario hace clic en link de confirmación de email
 * 2. Supabase redirige aquí con ?code=xxx
 * 3. Intercambiamos el código por una sesión (cookies)
 * 4. Redirigimos al dashboard
 */

import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET(request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const redirectTo = requestUrl.searchParams.get('redirectTo') || '/dashboard';
  const origin = requestUrl.origin;

  console.log('[Auth Callback] Procesando callback...', { code: code ? 'presente' : 'ausente', redirectTo });

  // Si no hay código, redirigir a login con mensaje
  if (!code) {
    console.warn('[Auth Callback] No se encontró código en la URL');
    const loginUrl = new URL('/login', origin);
    loginUrl.searchParams.set('error', 'no_code');
    loginUrl.searchParams.set('message', 'Link de confirmación inválido o expirado');
    return NextResponse.redirect(loginUrl);
  }

  try {
    const cookieStore = cookies();
    const supabase = createClient(cookieStore);

    // Intercambiar código por sesión (PKCE)
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error('[Auth Callback] Error exchangeCodeForSession:', error);
      
      // Redirigir a login con error específico
      const loginUrl = new URL('/login', origin);
      loginUrl.searchParams.set('error', 'auth_callback_error');
      loginUrl.searchParams.set('message', error.message || 'Error al confirmar tu cuenta');
      return NextResponse.redirect(loginUrl);
    }

    if (!data.session) {
      console.warn('[Auth Callback] No se obtuvo sesión después del exchange');
      const loginUrl = new URL('/login', origin);
      loginUrl.searchParams.set('error', 'no_session');
      loginUrl.searchParams.set('message', 'No se pudo establecer la sesión. Intenta iniciar sesión');
      return NextResponse.redirect(loginUrl);
    }

    console.log('[Auth Callback] ✓ Sesión establecida para:', data.user?.email);

    // Verificar si el email está confirmado
    const emailConfirmed = data.user?.email_confirmed_at || data.user?.confirmed_at;
    
    if (!emailConfirmed) {
      console.warn('[Auth Callback] Email no confirmado para:', data.user?.email);
    } else {
      console.log('[Auth Callback] ✓ Email confirmado:', emailConfirmed);
    }

    // Redirigir al destino final (default: dashboard)
    const redirectUrl = new URL(redirectTo, origin);
    
    // Agregar flag de confirmación exitosa (opcional, para mostrar mensaje de bienvenida)
    redirectUrl.searchParams.set('confirmed', 'true');
    
    return NextResponse.redirect(redirectUrl);

  } catch (err) {
    console.error('[Auth Callback] Error inesperado:', err);
    
    const loginUrl = new URL('/login', origin);
    loginUrl.searchParams.set('error', 'unexpected_error');
    loginUrl.searchParams.set('message', 'Error inesperado al procesar la confirmación');
    return NextResponse.redirect(loginUrl);
  }
}
