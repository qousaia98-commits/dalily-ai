/**
 * Retry helpers (Sprint 9.5 Phase 6).
 * Opt-in only — default outbound calls do not retry (preserves prior behaviour).
 */

export type RetryOptions = {
  attempts: number;
  /** Delay between attempts in ms (constant). */
  delayMs?: number;
  shouldRetry?: (error: unknown, attempt: number) => boolean;
};

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions,
): Promise<T> {
  const attempts = Math.max(1, options.attempts);
  const delayMs = options.delayMs ?? 0;
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const retry =
        attempt < attempts &&
        (options.shouldRetry ? options.shouldRetry(error, attempt) : true);
      if (!retry) break;
      if (delayMs > 0) {
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }
  }
  throw lastError;
}
