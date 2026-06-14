/**
 * Cliente Supabase para Client Components
 * Usa cookies para auth (consistente con middleware)
 *
 * USO:
 * import { createClient } from "@/lib/supabase/client"
 * const supabase = createClient()
 */

import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import type { Database } from "@/src/types/database.types";

export const createClient = () => createClientComponentClient<Database>();
