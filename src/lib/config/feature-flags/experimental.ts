/**
 * Experimental / stabilization markers.
 */

/**
 * Sprint 5.5 — Stabilization helpers are always on in app code;
 * no feature flag required. Use this marker for docs/CI only.
 */
export function isSprint55Stabilization(): boolean {
  return true;
}
