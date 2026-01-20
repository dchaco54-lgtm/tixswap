/**
 * Cliente Supabase para Server Components y Route Handlers
 * Usa cookies para auth (consistente con middleware)
 * 
 * USO en Route Handler:
 * import { createClient } from '@/lib/supabase/server'
 * import { cookies } from 'next/headers'
 * const supabase = createClient(cookies())
 * 
 * USO en Server Component:
 * import { createServerClient } from '@/lib/supabase/server'
 * import { cookies } from 'next/headers'
 * const supabase = createServerClient(cookies())
 */

import { createRouteHandlerClient, createServerComponentClient } from '@supabase/auth-helpers-nextjs';

export const createClient = (cookieStore) => createRouteHandlerClient({ cookies: () => cookieStore });

export const createServerClient = (cookieStore) => createServerComponentClient({ cookies: () => cookieStore });
