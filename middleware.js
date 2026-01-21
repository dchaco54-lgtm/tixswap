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
  
  // Si es admin route, verificar que tenga user_type admin O email específico
  if (req.nextUrl.pathname.startsWith('/admin') && session) {
    const userType =
      session.user?.user_metadata?.user_type ||
      session.user?.app_metadata?.user_type ||
      session.user?.user_metadata?.role || // fallback legacy
      session.user?.app_metadata?.role;

    const userEmail = session.user?.email?.toLowerCase();
    const isAdminByEmail = userEmail === 'davidchacon_17@hotmail.com';

    // Permitir acceso si es admin por tipo O por email
    if (userType !== 'admin' && !isAdminByEmail) {
      console.log('🚫 Middleware bloqueando acceso admin:', { userType, userEmail, isAdminByEmail });
      // Redirigir a dashboard si no es admin
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }
    
    console.log('✅ Middleware permitiendo acceso admin:', { userType, userEmail, isAdminByEmail });
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
