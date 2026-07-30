/**
 * RC2.1 P0 — Allowed payment lifecycle transitions.
 * Duplicate transitions (same status) are accepted as no-ops by the orchestrator.
 */

import type { PaymentLifecycleStatus } from "@/lib/payment/canonical-types";

/** Forward edges only. Terminal statuses have empty or refund/dispute exits. */
export const PAYMENT_STATUS_TRANSITIONS: Record<
  PaymentLifecycleStatus,
  readonly PaymentLifecycleStatus[]
> = {
  pending: [
    "pending_review",
    "authorized",
    "captured",
    "paid",
    "failed",
    "cancelled",
    "expired",
    "rejected",
  ],
  pending_review: ["paid", "rejected", "cancelled", "failed", "authorized"],
  authorized: ["captured", "paid", "cancelled", "failed", "expired", "disputed"],
  captured: [
    "reserved",
    "released",
    "paid",
    "refunded",
    "partially_refunded",
    "disputed",
    "cancelled",
  ],
  reserved: [
    "released",
    "refunded",
    "partially_refunded",
    "disputed",
    "cancelled",
  ],
  released: ["refunded", "partially_refunded", "disputed"],
  paid: [
    "reserved",
    "captured",
    "released",
    "refunded",
    "partially_refunded",
    "disputed",
    "cancelled",
  ],
  partially_refunded: ["refunded", "disputed"],
  refunded: [],
  failed: [],
  cancelled: [],
  rejected: [],
  expired: [],
  disputed: [
    "released",
    "refunded",
    "partially_refunded",
    "cancelled",
    "paid",
  ],
};

export function canTransitionPaymentStatus(
  from: PaymentLifecycleStatus,
  to: PaymentLifecycleStatus,
): boolean {
  if (from === to) return true;
  const allowed = PAYMENT_STATUS_TRANSITIONS[from];
  return allowed?.includes(to) ?? false;
}

export const ESCROW_STATUS_TRANSITIONS: Record<
  string,
  readonly string[]
> = {
  pending: ["reserved", "cancelled", "expired"],
  reserved: ["released", "refunded", "partially_refunded", "disputed", "cancelled"],
  disputed: ["released", "refunded", "partially_refunded", "cancelled"],
  released: [],
  refunded: [],
  partially_refunded: ["refunded"],
  cancelled: [],
  expired: [],
};

export function canTransitionEscrowStatus(from: string, to: string): boolean {
  if (from === to) return true;
  return (ESCROW_STATUS_TRANSITIONS[from] ?? []).includes(to);
}
