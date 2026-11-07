// Fixed-window rate limits kept in memory. The builder runs as one container (Dokploy), so a
// process-local counter is enough; a second replica would need a shared store.

export interface RateLimiter {
  /** Counts one hit for `key`; `ok` is false once the window's limit is used up. */
  take(key: string, now?: number): { ok: boolean; retryAfterMs: number };
}

const PRUNE_AT = 10_000;

export function createRateLimiter(limit: number, windowMs: number): RateLimiter {
  const windows = new Map<string, { count: number; resetAt: number }>();
  return {
    take(key, now = Date.now()) {
      if (windows.size > PRUNE_AT)
        for (const [k, w] of windows) if (w.resetAt <= now) windows.delete(k);
      const current = windows.get(key);
      if (!current || current.resetAt <= now) {
        windows.set(key, { count: 1, resetAt: now + windowMs });
        return { ok: true, retryAfterMs: 0 };
      }
      if (current.count >= limit) return { ok: false, retryAfterMs: current.resetAt - now };
      current.count++;
      return { ok: true, retryAfterMs: 0 };
    }
  };
}
