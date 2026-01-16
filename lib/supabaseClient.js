import { createClient } from "@supabase/supabase-js";

/**
 * We intentionally avoid throwing at import-time when env vars are missing.
 * A thrown error here crashes the whole UI ("Application error: a client-side exception...").
 *
 * If envs are missing, we export a stub client that behaves like supabase-js builders:
 * you can still `await supabase.from(...).select(...)` and you will get { data: null, error }.
 */

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_PROJECT_URL ||
  "";

const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANONKEY ||
  "";

// Minimal thenable builder that returns { data:null, error } for any awaited query
function createStubBuilder(error) {
  const result = { data: null, error };

  const builder = {
    select: () => builder,
    insert: () => builder,
    update: () => builder,
    upsert: () => builder,
    delete: () => builder,

    eq: () => builder,
    neq: () => builder,
    in: () => builder,
    match: () => builder,
    order: () => builder,
    limit: () => builder,
    range: () => builder,
    ilike: () => builder,
    like: () => builder,
    gte: () => builder,
    lte: () => builder,

    single: async () => result,
    maybeSingle: async () => result,

    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
    catch: (reject) => Promise.resolve(result).catch(reject),
    finally: (fn) => Promise.resolve(result).finally(fn),
  };

  return builder;
}

function createStubClient(message) {
  const error = new Error(message);

  return {
    __stub: true,
    auth: {
      getSession: async () => ({ data: { session: null }, error }),
      getUser: async () => ({ data: { user: null }, error }),
      onAuthStateChange: () => ({
        data: { subscription: { unsubscribe: () => {} } },
      }),
      signOut: async () => ({ error }),
    },
    from: () => createStubBuilder(error),
    rpc: () => createStubBuilder(error),
    storage: {
      from: () => ({
        upload: async () => ({ data: null, error }),
        download: async () => ({ data: null, error }),
        getPublicUrl: () => ({ data: { publicUrl: "" }, error }),
      }),
    },
  };
}

let supabase;

if (supabaseUrl && supabaseAnonKey) {
  supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
      storageKey: 'sb-auth-token',
      flowType: 'pkce',
    },
  });
} else {
  // DO NOT crash the app. Log for debugging.
  console.error(
    "[TixSwap] Missing Supabase env vars. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY."
  );
  supabase = createStubClient(
    "Missing Supabase env vars (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY)."
  );
}

export default supabase;
export { supabase };
