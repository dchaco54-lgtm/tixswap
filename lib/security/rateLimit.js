const STORE_KEY = "__tixswap_rate_limit_store";

const store = globalThis[STORE_KEY] || new Map();
if (!globalThis[STORE_KEY]) {
  globalThis[STORE_KEY] = store;
}

export function getClientIp(req) {
  const forwarded = req.headers.get("x-forwarded-for") || "";
  const realIp = req.headers.get("x-real-ip") || "";

  const firstForwarded = forwarded.split(",")[0]?.trim();
  return firstForwarded || realIp || "unknown";
}

export function consumeRateLimit({ key, limit = 10, windowMs = 60_000 }) {
  const now = Date.now();
  const current = store.get(key);

  if (!current || current.resetAt <= now) {
    const entry = {
      count: 1,
      resetAt: now + windowMs,
    };
    store.set(key, entry);
    return {
      ok: true,
      remaining: Math.max(0, limit - entry.count),
      retryAfterMs: 0,
      resetAt: entry.resetAt,
    };
  }

  if (current.count >= limit) {
    return {
      ok: false,
      remaining: 0,
      retryAfterMs: Math.max(0, current.resetAt - now),
      resetAt: current.resetAt,
    };
  }

  current.count += 1;
  store.set(key, current);

  return {
    ok: true,
    remaining: Math.max(0, limit - current.count),
    retryAfterMs: 0,
    resetAt: current.resetAt,
  };
}

export function rateLimitByRequest(req, config) {
  const ip = getClientIp(req);
  const bucket = config?.bucket || "default";
  return consumeRateLimit({
    key: `${bucket}:${ip}`,
    limit: config?.limit,
    windowMs: config?.windowMs,
  });
}
