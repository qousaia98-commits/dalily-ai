import { describe, expect, it } from "vitest";
import {
  PAYMENT_STATUS_TRANSITIONS,
  ESCROW_STATUS_TRANSITIONS,
  canTransitionPaymentStatus,
  canTransitionEscrowStatus,
} from "@/lib/payment/state-machine";
import type { PaymentLifecycleStatus } from "@/lib/payment/canonical-types";

const ALL_PAYMENT_STATUSES = Object.keys(
  PAYMENT_STATUS_TRANSITIONS,
) as PaymentLifecycleStatus[];

describe("payment state machine", () => {
  it("allows every documented forward transition", () => {
    for (const [from, tos] of Object.entries(PAYMENT_STATUS_TRANSITIONS)) {
      for (const to of tos) {
        expect(
          canTransitionPaymentStatus(
            from as PaymentLifecycleStatus,
            to as PaymentLifecycleStatus,
          ),
        ).toBe(true);
      }
    }
  });

  it("treats same-status as idempotent no-op (allowed)", () => {
    for (const status of ALL_PAYMENT_STATUSES) {
      expect(canTransitionPaymentStatus(status, status)).toBe(true);
    }
  });

  it("rejects transitions not in the allow-list", () => {
    expect(canTransitionPaymentStatus("refunded", "pending")).toBe(false);
    expect(canTransitionPaymentStatus("failed", "paid")).toBe(false);
    expect(canTransitionPaymentStatus("cancelled", "authorized")).toBe(false);
    expect(canTransitionPaymentStatus("expired", "captured")).toBe(false);
    expect(canTransitionPaymentStatus("released", "reserved")).toBe(false);
  });

  it("terminal statuses have empty forward edges", () => {
    for (const terminal of [
      "refunded",
      "failed",
      "cancelled",
      "rejected",
      "expired",
    ] as const) {
      expect(PAYMENT_STATUS_TRANSITIONS[terminal]).toEqual([]);
    }
  });

  it("covers all PaymentLifecycleStatus keys", () => {
    const expected: PaymentLifecycleStatus[] = [
      "pending",
      "pending_review",
      "authorized",
      "captured",
      "reserved",
      "released",
      "paid",
      "refunded",
      "partially_refunded",
      "failed",
      "cancelled",
      "rejected",
      "expired",
      "disputed",
    ];
    expect(ALL_PAYMENT_STATUSES.sort()).toEqual(expected.sort());
  });
});

describe("escrow state machine", () => {
  it("allows reserved → released / refunded / disputed", () => {
    expect(canTransitionEscrowStatus("reserved", "released")).toBe(true);
    expect(canTransitionEscrowStatus("reserved", "refunded")).toBe(true);
    expect(canTransitionEscrowStatus("reserved", "disputed")).toBe(true);
  });

  it("rejects released → reserved and released → refunded", () => {
    expect(canTransitionEscrowStatus("released", "reserved")).toBe(false);
    expect(canTransitionEscrowStatus("released", "refunded")).toBe(false);
    expect(ESCROW_STATUS_TRANSITIONS.released).toEqual([]);
  });
});
