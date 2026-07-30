import { describe, expect, it } from "vitest";
import { computeRiskFromSignals } from "@/lib/fraud/engine";
import { scoreToRiskLevel } from "@/lib/fraud/types";
import type { FraudRawSignals } from "@/lib/fraud/signals";
import type { RuleWeight } from "@/lib/fraud/weights";
import type { SignalCollector } from "@/lib/fraud/signals";

function emptyRaw(overrides: Partial<FraudRawSignals> = {}): FraudRawSignals {
  return {
    providerCountForOwner: 1,
    customerDuplicateHint: 0,
    failedPaymentCount30d: 0,
    refundRate30d: 0,
    highFakeReviewCount: 0,
    ratingSwing: 0,
    cancelledBookingCount30d: 0,
    noShowCount90d: 0,
    suspiciousMessageFlags: 0,
    accountsCreated24hSameSignal: 0,
    deviceShareCount: 0,
    locationMismatchScore: 0,
    identityChangeCount90d: 0,
    policyViolationCount: 0,
    mlRiskScore: null,
    ...overrides,
  };
}

const simpleCollectors: SignalCollector[] = [
  {
    signalKey: "sig_a",
    category: "test",
    computeNormalized: (raw) => ({
      rawValue: raw.failedPaymentCount30d,
      normalizedValue: Math.min(1, raw.failedPaymentCount30d / 10),
    }),
  },
  {
    signalKey: "sig_b",
    category: "test",
    computeNormalized: (raw) => ({
      rawValue: raw.refundRate30d,
      normalizedValue: Math.min(1, raw.refundRate30d),
    }),
  },
];

const simpleRules: RuleWeight[] = [
  {
    ruleKey: "sig_a",
    category: "test",
    weight: 1,
    threshold: 0.5,
    enabled: true,
    mlReady: false,
    autoActions: ["flag_account"],
  },
  {
    ruleKey: "sig_b",
    category: "test",
    weight: 1,
    threshold: 0.5,
    enabled: true,
    mlReady: false,
    autoActions: ["require_manual_review"],
  },
];

describe("computeRiskFromSignals", () => {
  it("is deterministic for identical inputs", () => {
    const input = {
      entityType: "provider" as const,
      entityId: "p1",
      raw: emptyRaw({ failedPaymentCount30d: 8, refundRate30d: 0.7 }),
      rules: simpleRules,
      collectors: simpleCollectors,
      includeMlLayer: false,
    };
    const a = computeRiskFromSignals(input);
    const b = computeRiskFromSignals(input);
    expect(a.internalScore).toBe(b.internalScore);
    expect(a.riskLevel).toBe(b.riskLevel);
    expect(a.triggeredRules).toEqual(b.triggeredRules);
    expect(a.explanation).toBe(b.explanation);
  });

  it("is monotonic: more risk signals → equal or higher score", () => {
    const base = computeRiskFromSignals({
      entityType: "provider",
      entityId: "p1",
      raw: emptyRaw({ failedPaymentCount30d: 2 }),
      rules: simpleRules,
      collectors: simpleCollectors,
      includeMlLayer: false,
    });
    const more = computeRiskFromSignals({
      entityType: "provider",
      entityId: "p1",
      raw: emptyRaw({ failedPaymentCount30d: 2, refundRate30d: 0.9 }),
      rules: simpleRules,
      collectors: simpleCollectors,
      includeMlLayer: false,
    });
    expect(more.internalScore).toBeGreaterThanOrEqual(base.internalScore);
  });

  it("respects documented scoreToRiskLevel thresholds", () => {
    expect(scoreToRiskLevel(0)).toBe("low");
    expect(scoreToRiskLevel(34.99)).toBe("low");
    expect(scoreToRiskLevel(35)).toBe("medium");
    expect(scoreToRiskLevel(59.99)).toBe("medium");
    expect(scoreToRiskLevel(60)).toBe("high");
    expect(scoreToRiskLevel(79.99)).toBe("high");
    expect(scoreToRiskLevel(80)).toBe("critical");
    expect(scoreToRiskLevel(100)).toBe("critical");
  });

  it("maps zero signals to low risk", () => {
    const r = computeRiskFromSignals({
      entityType: "customer",
      entityId: "c1",
      raw: emptyRaw(),
      rules: simpleRules,
      collectors: simpleCollectors,
      includeMlLayer: false,
    });
    expect(r.internalScore).toBe(0);
    expect(r.riskLevel).toBe("low");
    expect(r.triggeredRules).toEqual([]);
  });

  it("never suggests permanent_suspend", () => {
    const rules: RuleWeight[] = [
      {
        ruleKey: "sig_a",
        category: "test",
        weight: 10,
        threshold: 0,
        enabled: true,
        mlReady: false,
        // force path that would remap permanent_suspend if cast somehow
        autoActions: ["escalate_to_admin"],
      },
    ];
    const r = computeRiskFromSignals({
      entityType: "provider",
      entityId: "p1",
      raw: emptyRaw({ failedPaymentCount30d: 10 }),
      rules,
      collectors: simpleCollectors,
      includeMlLayer: false,
    });
    expect(r.suggestedAction).not.toBe("permanent_suspend");
  });
});
