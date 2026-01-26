import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';

const ADMIN_EMAILS = new Set([
  'davidchacon_17@hotmail.com',
  'soporte@tixswap.cl',
]);

function normalizeRole(v) {
  if (!v) return '';
  return String(v).toLowerCase().trim();
}

export async function middleware(req) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });

  const { data: { session } } = await supabase.auth.getSession();

  const protectedPaths = ['/dashboard', '/sell', '/admin'];
  const isProtected = protectedPaths.some((path) => req.nextUrl.pathname.startsWith(path));

  if (isProtected && !session) {
    const redirectUrl = new URL('/login', req.url);
    redirectUrl.searchParams.set('redirectTo', req.nextUrl.pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // Admin guard
  if (req.nextUrl.pathname.startsWith('/admin') && session) {
    const userEmail = (session.user?.email || '').toLowerCase();

    // 1) Intentar sacar el rol desde metadata (a veces viene vacío)
    const metaRole =
      session.user?.user_metadata?.user_type ||
      session.user?.app_metadata?.user_type ||
      session.user?.user_metadata?.role ||
      session.user?.app_metadata?.role;

    let role = normalizeRole(metaRole);

    // 2) Si metadata no trae role, consultar profiles.user_type (source of truth)
    if (role !== 'admin') {
      const { data: prof, error: profErr } = await supabase
        .from('profiles')
        .select('user_type')
        .eq('id', session.user.id)
        .maybeSingle();

      if (!profErr && prof?.user_type) {
        role = normalizeRole(prof.user_type);
      }
    }

    const isAdmin = role === 'admin' || ADMIN_EMAILS.has(userEmail);

    if (!isAdmin) {
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }
  }

  return res;
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};

