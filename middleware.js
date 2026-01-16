import { NextResponse } from 'next/server';

export async function middleware(req) {
  const { pathname } = req.nextUrl;

  // Rutas que requieren autenticación
  const protectedPaths = ['/checkout', '/sell', '/dashboard', '/disputes'];
  
  const isProtectedPath = protectedPaths.some(path => pathname.startsWith(path));

  // Si es una ruta protegida, verificar el token de Supabase en las cookies
  if (isProtectedPath) {
    // Buscar el token de autenticación de Supabase en las cookies
    const token = req.cookies.get('sb-auth-token');
    
    // Si no hay token, redirigir a login
    if (!token || !token.value) {
      const redirectUrl = new URL('/login', req.url);
      redirectUrl.searchParams.set('redirectTo', pathname);
      return NextResponse.redirect(redirectUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
