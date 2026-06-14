import { NextRequest, NextResponse } from 'next/server';

/**
 * Auth Callback Route Handler
 *
 * El GET NO verifica el token — solo redirige a /auth/confirm donde el usuario
 * debe hacer click. Esto evita que escáneres de seguridad de correo consuman
 * el token antes que el usuario lo use.
 */

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const tokenHash =
    requestUrl.searchParams.get('token_hash') ||
    requestUrl.searchParams.get('token');
  const type = requestUrl.searchParams.get('type');
  const errorParam = requestUrl.searchParams.get('error');
  const errorDescription = requestUrl.searchParams.get('error_description');
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
  ).replace(/\/+$/, '');

  // Supabase envió un error en el redirect
  if (errorParam) {
    const message = errorDescription || errorParam;
    return NextResponse.redirect(
      new URL(`/login?error=auth_error&message=${encodeURIComponent(message)}`, origin)
    );
  }

  if (!code && !tokenHash) {
    return NextResponse.redirect(
      new URL(
        `/login?error=no_code&message=${encodeURIComponent('Link de confirmación inválido.')}`,
        origin
      )
    );
  }

  // Redirigir a la página de confirmación — el token NO se verifica aquí
  const confirmUrl = new URL('/auth/confirm', origin);
  if (code) confirmUrl.searchParams.set('code', code);
  if (tokenHash) confirmUrl.searchParams.set('token_hash', tokenHash);
  if (type) confirmUrl.searchParams.set('type', type);
  confirmUrl.searchParams.set('redirectTo', redirectTo);

  return NextResponse.redirect(confirmUrl);
}

export async function POST(request: NextRequest) {
  return GET(request);
}

export const dynamic = 'force-dynamic';
