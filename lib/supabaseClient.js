// lib/supabaseClient.js
import { createClient } from "@supabase/supabase-js";

// Compat: aceptamos nombres de env antiguos para no romper despliegues
const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;

const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_KEY || // algunos proyectos lo usan así
  process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl) throw new Error("Falta NEXT_PUBLIC_SUPABASE_URL (o SUPABASE_URL)");
if (!supabaseAnonKey)
  throw new Error(
    "Falta NEXT_PUBLIC_SUPABASE_ANON_KEY (o NEXT_PUBLIC_SUPABASE_KEY / SUPABASE_ANON_KEY)"
  );

const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default supabase;
