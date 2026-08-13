/**
 * Pure escrow CAS helpers — status filters for optimistic concurrency updates.
 */

import { canTransitionEscrowStatus } from "@/lib/payment/state-machine";

/**
 * Current statuses that must still match for a CAS update to `toStatus`.
 * Mirrors `.in("status", …)` filters in the escrow engine.
 */
export function escrowCasExpectedStatuses(toStatus: string): string[] {
  switch (toStatus) {
    case "released":
    case "refunded":
    case "partially_refunded":
      return ["reserved", "disputed"];
    case "disputed":
      return ["reserved"];
    case "cancelled":
      return ["pending", "reserved"];
    default:
      return [];
  }
}

/**
 * Decide whether a CAS transition may proceed before writing.
 * Returns an error code when rejected (including concurrent/stale simulation
 * when `currentStatusForCas` is already past the expected set).
 */
export function evaluateEscrowCasTransition(input: {
  fromStatus: string;
  toStatus: string;
  /** If provided and not in expected CAS set → concurrent/stale rejection */
  rowStatusAtUpdate?: string;
}): { ok: true } | { ok: false; error: "invalid_status" | "stale_state" } {
  if (!canTransitionEscrowStatus(input.fromStatus, input.toStatus)) {
    return { ok: false, error: "invalid_status" };
  }
  if (input.fromStatus === input.toStatus) {
    return { ok: true };
  }
  const expected = escrowCasExpectedStatuses(input.toStatus);
  if (expected.length === 0) {
    return { ok: false, error: "invalid_status" };
  }
  if (
    input.rowStatusAtUpdate != null &&
    !expected.includes(input.rowStatusAtUpdate)
  ) {
    return { ok: false, error: "stale_state" };
  }
  return { ok: true };
}

export function fundedViaFromMetadata(
  metadata: unknown,
): "external" | "wallet" {
  if (metadata && typeof metadata === "object") {
    const v = (metadata as Record<string, unknown>).fundedVia;
    if (v === "wallet") return "wallet";
  }
  return "external";
}

export function mergeEscrowMetadata(
  existing: unknown,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const base =
    existing && typeof existing === "object"
      ? { ...(existing as Record<string, unknown>) }
      : {};
  return { ...base, ...patch };
}
