import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    
    const { data: { session }, error } = await supabase.auth.getSession();
    
    // Log all cookies
    const allCookies = {};
    cookieStore.getAll().forEach(cookie => {
      allCookies[cookie.name] = `${cookie.value.substring(0, 20)}...`;
    });
    
    return NextResponse.json({
      session: session ? {
        user: session.user.id,
        email: session.user.email,
        expiresAt: session.expires_at
      } : null,
      error,
      cookies: allCookies,
      cookieCount: cookieStore.getAll().length
    });
  } catch (err) {
    return NextResponse.json({
      error: err.message
    }, { status: 500 });
  }
}
