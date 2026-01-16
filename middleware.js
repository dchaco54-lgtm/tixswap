import { NextResponse } from 'next/server';

export async function middleware(req) {
  // El middleware solo pasa requests sin verificar sesión
  // porque Supabase usa localStorage (client-side) no cookies
  // La verificación de autenticación se hace en cada página protegida
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
