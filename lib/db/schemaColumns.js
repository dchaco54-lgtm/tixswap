const columnPresenceCache = new Map();

function getCacheKey(tableName, columnName) {
  return `public.${tableName}.${columnName}`;
}

/**
 * Best-effort check de existencia de columna en Supabase/Postgres.
 * Prioriza information_schema y cae a un select mínimo si esa vista no responde.
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 * @param {string} tableName
 * @param {string} columnName
 * @returns {Promise<boolean>}
 */
export async function tableHasColumn(supabase, tableName, columnName) {
  if (!supabase || typeof supabase.from !== "function") return false;

  const cacheKey = getCacheKey(tableName, columnName);
  if (columnPresenceCache.has(cacheKey)) {
    return columnPresenceCache.get(cacheKey);
  }

  try {
    const { data, error } = await supabase
      .from("information_schema.columns")
      .select("column_name")
      .eq("table_schema", "public")
      .eq("table_name", tableName)
      .eq("column_name", columnName)
      .limit(1);

    if (!error) {
      const hasColumn = Array.isArray(data) && data.length > 0;
      columnPresenceCache.set(cacheKey, hasColumn);
      return hasColumn;
    }
  } catch {
    // noop
  }

  try {
    const { error } = await supabase.from(tableName).select(columnName).limit(1);
    const hasColumn = !error;
    columnPresenceCache.set(cacheKey, hasColumn);
    return hasColumn;
  } catch {
    columnPresenceCache.set(cacheKey, false);
    return false;
  }
}
