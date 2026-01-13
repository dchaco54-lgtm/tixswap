// app/lib/supabaseClient.js
// Este wrapper existe para imports relativos desde /app.
// OJO: `export *` NO re-exporta el default, por eso supabase quedaba undefined.

export { default } from "../../lib/supabaseClient";
export * from "../../lib/supabaseClient";
