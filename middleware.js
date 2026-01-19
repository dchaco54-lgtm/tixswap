import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';

export async function middleware(req) {
  const res = NextResponse.next();
  
  // Crear cliente de Supabase con cookies de middleware
  const supabase = createMiddlewareClient({ req, res });
  
  // Obtener sesión actual
  const { data: { session } } = await supabase.auth.getSession();
  
  // Rutas protegidas que requieren autenticación
  const protectedPaths = ['/dashboard', '/sell', '/admin'];
  const isProtected = protectedPaths.some(path => req.nextUrl.pathname.startsWith(path));
  
  // Si es ruta protegida y no hay sesión, redirigir a login
  if (isProtected && !session) {
    const redirectUrl = new URL('/login', req.url);
    redirectUrl.searchParams.set('redirectTo', req.nextUrl.pathname);
    return NextResponse.redirect(redirectUrl);
  }
  
  // Si es admin route, verificar que tenga rol admin
  if (req.nextUrl.pathname.startsWith('/admin') && session) {
    // Obtener rol del usuario desde metadata o profiles
    const userRole = session.user?.user_metadata?.role || session.user?.app_metadata?.role;
    
    if (userRole !== 'admin') {
      // Redirigir a dashboard si no es admin
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }
  }
  
  return res;
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
