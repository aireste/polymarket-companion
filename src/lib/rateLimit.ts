/**
 * Best-effort in-memory sliding-window rate limiter.
 *
 * IMPORTANT: on serverless (Vercel) this state is PER-INSTANCE and resets on
 * cold starts, so it reduces casual abuse and accidental hammering but is not a
 * hard cross-instance guarantee. The real cost backstop is the monthly spend
 * cap configured in the Anthropic console. For a hard, shared limit, swap the
 * Map for a shared store (e.g. Upstash Redis).
 */

const WINDOW_MS = 60 * 60 * 1000; // 1 hour
const MAX_HITS = 6; // messages per window per key

const hits = new Map<string, number[]>();

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  /** Seconds until the oldest hit falls out of the window (only when blocked). */
  retryAfterSec: number;
}

export function rateLimit(
  key: string,
  max = MAX_HITS,
  windowMs = WINDOW_MS
): RateLimitResult {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);

  if (recent.length >= max) {
    const retryMs = windowMs - (now - recent[0]);
    return { ok: false, remaining: 0, retryAfterSec: Math.ceil(retryMs / 1000) };
  }

  recent.push(now);
  hits.set(key, recent);

  // Opportunistic cleanup so the Map can't grow without bound.
  if (hits.size > 5000) {
    for (const [k, v] of hits) {
      if (v.every((t) => now - t >= windowMs)) hits.delete(k);
    }
  }

  return { ok: true, remaining: max - recent.length, retryAfterSec: 0 };
}

/** Derive a best-effort client key from request headers. */
export function clientKey(request: Request): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}
