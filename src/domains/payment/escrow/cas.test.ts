import { describe, expect, it } from "vitest";
import {
  evaluateEscrowCasTransition,
  escrowCasExpectedStatuses,
  mergeEscrowMetadata,
  fundedViaFromMetadata,
} from "@/domains/payment/escrow/cas";

describe("escrow CAS transitions", () => {
  it("allows valid reserved → released", () => {
    expect(
      evaluateEscrowCasTransition({
        fromStatus: "reserved",
        toStatus: "released",
        rowStatusAtUpdate: "reserved",
      }),
    ).toEqual({ ok: true });
  });

  it("allows disputed → released when row still disputed", () => {
    expect(
      evaluateEscrowCasTransition({
        fromStatus: "disputed",
        toStatus: "released",
        rowStatusAtUpdate: "disputed",
      }),
    ).toEqual({ ok: true });
  });

  it("rejects invalid transitions (released → refunded)", () => {
    expect(
      evaluateEscrowCasTransition({
        fromStatus: "released",
        toStatus: "refunded",
      }),
    ).toEqual({ ok: false, error: "invalid_status" });
  });

  it("rejects refunded → released", () => {
    expect(
      evaluateEscrowCasTransition({
        fromStatus: "refunded",
        toStatus: "released",
      }),
    ).toEqual({ ok: false, error: "invalid_status" });
  });

  it("rejects concurrent/stale row status (already released)", () => {
    expect(
      evaluateEscrowCasTransition({
        fromStatus: "reserved",
        toStatus: "released",
        rowStatusAtUpdate: "released",
      }),
    ).toEqual({ ok: false, error: "stale_state" });
  });

  it("rejects stale refund when row already refunded", () => {
    expect(
      evaluateEscrowCasTransition({
        fromStatus: "reserved",
        toStatus: "refunded",
        rowStatusAtUpdate: "refunded",
      }),
    ).toEqual({ ok: false, error: "stale_state" });
  });

  it("CAS expected statuses match engine filters", () => {
    expect(escrowCasExpectedStatuses("released")).toEqual([
      "reserved",
      "disputed",
    ]);
    expect(escrowCasExpectedStatuses("refunded")).toEqual([
      "reserved",
      "disputed",
    ]);
    expect(escrowCasExpectedStatuses("disputed")).toEqual(["reserved"]);
    expect(escrowCasExpectedStatuses("cancelled")).toEqual([
      "pending",
      "reserved",
    ]);
  });

  it("mergeEscrowMetadata preserves fundedVia (no double-credit bug)", () => {
    const merged = mergeEscrowMetadata(
      { fundedVia: "wallet", fees: { platformFee: 10 } },
      { refund: { amount: 50 } },
    );
    expect(merged.fundedVia).toBe("wallet");
    expect(fundedViaFromMetadata(merged)).toBe("wallet");
    expect((merged.fees as { platformFee: number }).platformFee).toBe(10);
  });

  it("same-status is treated as ok (idempotent)", () => {
    expect(
      evaluateEscrowCasTransition({
        fromStatus: "released",
        toStatus: "released",
      }),
    ).toEqual({ ok: true });
  });
});
