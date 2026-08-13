/**
 * Timeout + AbortController helpers (Sprint 9.5 Phase 6).
 * Single place for timeout wiring — callers must not reinvent AbortController.
 */

export function withTimeout(
  timeoutMs: number,
  external?: AbortSignal,
): { signal: AbortSignal; clear: () => void } {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  const onExternalAbort = () => controller.abort();
  if (external) {
    if (external.aborted) controller.abort();
    else external.addEventListener("abort", onExternalAbort, { once: true });
  }

  return {
    signal: controller.signal,
    clear: () => {
      clearTimeout(timeout);
      if (external) external.removeEventListener("abort", onExternalAbort);
    },
  };
}
