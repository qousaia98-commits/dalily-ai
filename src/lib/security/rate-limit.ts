/**
 * Sprint 5.5 — lightweight in-process rate limiter for Server Actions.
 * Not distributed; use Redis/Upstash before multi-instance scale-out.
 */

type Bucket = { timestamps: number[] };

const buckets = new Map<string, Bucket>();

export type RateLimitResult =
  | { ok: true; remaining: number }
  | { ok: false; retryAfterMs: number };

/**
 * Sliding-window limit: `max` events per `windowMs` for `key`.
 */
export function checkRateLimit(
  key: string,
  opts: { max: number; windowMs: number },
): RateLimitResult {
  const now = Date.now();
  const windowStart = now - opts.windowMs;
  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { timestamps: [] };
    buckets.set(key, bucket);
  }
  bucket.timestamps = bucket.timestamps.filter((t) => t > windowStart);
  if (bucket.timestamps.length >= opts.max) {
    const oldest = bucket.timestamps[0] ?? now;
    return { ok: false, retryAfterMs: Math.max(0, oldest + opts.windowMs - now) };
  }
  bucket.timestamps.push(now);
  return { ok: true, remaining: opts.max - bucket.timestamps.length };
}

/** Convenience keys for common action classes. */
export function rateLimitKey(scope: string, userId: string): string {
  return `${scope}:${userId}`;
}

/** Periodic cleanup to avoid unbounded Map growth in long-lived processes. */
export function pruneRateLimitBuckets(maxAgeMs = 3_600_000): void {
  const cutoff = Date.now() - maxAgeMs;
  for (const [key, bucket] of buckets) {
    bucket.timestamps = bucket.timestamps.filter((t) => t > cutoff);
    if (bucket.timestamps.length === 0) buckets.delete(key);
  }
}
