import { describe, expect, it } from "vitest";
import {
  calculateFeeBreakdownFromRules,
  applyFeeRule,
  getDefaultFeeRules,
  type FeeRule,
} from "@/domains/payment/fees/engine";

describe("fee engine", () => {
  it("applies default 10% platform fee on normal amount", () => {
    const result = calculateFeeBreakdownFromRules(
      { amount: 1000, currency: "SYP" },
      getDefaultFeeRules(),
    );
    expect(result.platformFee).toBe(100);
    expect(result.netToProvider).toBe(900);
    expect(result.totalCharged).toBe(1000);
    expect(result.appliedRuleCodes).toContain("platform_default");
  });

  it("clamps negative / zero amounts to non-negative gross", () => {
    const zero = calculateFeeBreakdownFromRules(
      { amount: 0 },
      getDefaultFeeRules(),
    );
    expect(zero.platformFee).toBe(0);
    expect(zero.netToProvider).toBe(0);
    expect(zero.totalCharged).toBe(0);

    const neg = calculateFeeBreakdownFromRules(
      { amount: -50 },
      getDefaultFeeRules(),
    );
    expect(neg.platformFee).toBe(0);
    expect(neg.totalCharged).toBe(0);
    expect(neg.netToProvider).toBe(0);
  });

  it("applies discount before fee percent", () => {
    const result = calculateFeeBreakdownFromRules(
      { amount: 1000, discountAmount: 200 },
      getDefaultFeeRules(),
    );
    // gross 800 → 10% = 80
    expect(result.discount).toBe(200);
    expect(result.platformFee).toBe(80);
    expect(result.netToProvider).toBe(720);
  });

  it("handles very small amounts with 2-decimal rounding", () => {
    const result = calculateFeeBreakdownFromRules(
      { amount: 0.03 },
      getDefaultFeeRules(),
    );
    // 0.03 * 0.1 = 0.003 → rounds to 0.00
    expect(result.platformFee).toBe(0);
    expect(result.totalCharged).toBe(0.03);
  });

  it("handles very large amounts without NaN", () => {
    const result = calculateFeeBreakdownFromRules(
      { amount: 1_000_000_000 },
      getDefaultFeeRules(),
    );
    expect(result.platformFee).toBe(100_000_000);
    expect(result.netToProvider).toBe(900_000_000);
    expect(Number.isFinite(result.totalCharged)).toBe(true);
  });

  it("rounds percent fees to cents (banker-style via Math.round)", () => {
    // 333 * 10% = 33.3 → 33.3
    const a = calculateFeeBreakdownFromRules(
      { amount: 333 },
      getDefaultFeeRules(),
    );
    expect(a.platformFee).toBe(33.3);

    // 1 bps of 1 = 0.0001 → rounds to 0
    const tinyRule: FeeRule[] = [
      {
        code: "tiny",
        feeType: "platform",
        calculation: "percent",
        percentBps: 1,
        fixedAmount: 0,
        enabled: true,
      },
    ];
    const b = calculateFeeBreakdownFromRules({ amount: 1 }, tinyRule);
    expect(b.platformFee).toBe(0);
  });

  it("supports fixed and hybrid calculation modes", () => {
    expect(
      applyFeeRule(1000, {
        code: "f",
        feeType: "platform",
        calculation: "fixed",
        percentBps: 1000,
        fixedAmount: 25,
        enabled: true,
      }),
    ).toBe(25);

    expect(
      applyFeeRule(1000, {
        code: "h",
        feeType: "platform",
        calculation: "hybrid",
        percentBps: 500,
        fixedAmount: 10,
        enabled: true,
      }),
    ).toBe(60);
  });

  it("skips disabled rules", () => {
    const rules: FeeRule[] = [
      {
        code: "off",
        feeType: "platform",
        calculation: "percent",
        percentBps: 5000,
        fixedAmount: 0,
        enabled: false,
      },
    ];
    const result = calculateFeeBreakdownFromRules({ amount: 100 }, rules);
    expect(result.platformFee).toBe(0);
    expect(result.appliedRuleCodes).toEqual([]);
  });
});
