/**
 * Modular fraud signal collectors.
 * Raw entity stats → normalized 0..1. ML layer can inject additional collectors.
 */

export type FraudRawSignals = {
  providerCountForOwner: number;
  customerDuplicateHint: number;
  failedPaymentCount30d: number;
  refundRate30d: number;
  highFakeReviewCount: number;
  ratingSwing: number;
  cancelledBookingCount30d: number;
  noShowCount90d: number;
  suspiciousMessageFlags: number;
  accountsCreated24hSameSignal: number;
  deviceShareCount: number;
  locationMismatchScore: number;
  identityChangeCount90d: number;
  policyViolationCount: number;
  /** Optional ML model output 0..1 — layered, never replaces rules. */
  mlRiskScore?: number | null;
};

export type SignalCollector = {
  signalKey: string;
  category: string;
  computeNormalized: (raw: FraudRawSignals) => {
    rawValue: number;
    normalizedValue: number;
    metadata?: Record<string, unknown>;
  };
};

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

export const FRAUD_SIGNAL_COLLECTORS: SignalCollector[] = [
  {
    signalKey: "multiple_provider_accounts",
    category: "identity",
    computeNormalized: (raw) => ({
      rawValue: raw.providerCountForOwner,
      normalizedValue: clamp01((raw.providerCountForOwner - 1) / 3),
    }),
  },
  {
    signalKey: "multiple_customer_accounts",
    category: "identity",
    computeNormalized: (raw) => ({
      rawValue: raw.customerDuplicateHint,
      normalizedValue: clamp01(raw.customerDuplicateHint),
    }),
  },
  {
    signalKey: "repeated_failed_payments",
    category: "payment",
    computeNormalized: (raw) => ({
      rawValue: raw.failedPaymentCount30d,
      normalizedValue: clamp01(raw.failedPaymentCount30d / 5),
    }),
  },
  {
    signalKey: "abnormal_refund_behaviour",
    category: "payment",
    computeNormalized: (raw) => ({
      rawValue: raw.refundRate30d,
      normalizedValue: clamp01(raw.refundRate30d / 0.4),
    }),
  },
  {
    signalKey: "fake_review_network",
    category: "review",
    computeNormalized: (raw) => ({
      rawValue: raw.highFakeReviewCount,
      normalizedValue: clamp01(raw.highFakeReviewCount / 3),
    }),
  },
  {
    signalKey: "rating_manipulation",
    category: "review",
    computeNormalized: (raw) => ({
      rawValue: raw.ratingSwing,
      normalizedValue: clamp01(raw.ratingSwing / 2),
    }),
  },
  {
    signalKey: "repeated_cancelled_bookings",
    category: "booking",
    computeNormalized: (raw) => ({
      rawValue: raw.cancelledBookingCount30d,
      normalizedValue: clamp01(raw.cancelledBookingCount30d / 6),
    }),
  },
  {
    signalKey: "no_show_patterns",
    category: "booking",
    computeNormalized: (raw) => ({
      rawValue: raw.noShowCount90d,
      normalizedValue: clamp01(raw.noShowCount90d / 3),
    }),
  },
  {
    signalKey: "suspicious_messaging",
    category: "messaging",
    computeNormalized: (raw) => ({
      rawValue: raw.suspiciousMessageFlags,
      normalizedValue: clamp01(raw.suspiciousMessageFlags / 4),
    }),
  },
  {
    signalKey: "rapid_account_creation",
    category: "identity",
    computeNormalized: (raw) => ({
      rawValue: raw.accountsCreated24hSameSignal,
      normalizedValue: clamp01(raw.accountsCreated24hSameSignal / 4),
    }),
  },
  {
    signalKey: "device_anomaly",
    category: "device",
    computeNormalized: (raw) => ({
      rawValue: raw.deviceShareCount,
      normalizedValue: clamp01(raw.deviceShareCount / 3),
    }),
  },
  {
    signalKey: "location_anomaly",
    category: "location",
    computeNormalized: (raw) => ({
      rawValue: raw.locationMismatchScore,
      normalizedValue: clamp01(raw.locationMismatchScore),
    }),
  },
  {
    signalKey: "repeated_identity_changes",
    category: "identity",
    computeNormalized: (raw) => ({
      rawValue: raw.identityChangeCount90d,
      normalizedValue: clamp01(raw.identityChangeCount90d / 3),
    }),
  },
  {
    signalKey: "policy_violation",
    category: "policy",
    computeNormalized: (raw) => ({
      rawValue: raw.policyViolationCount,
      normalizedValue: clamp01(raw.policyViolationCount / 2),
    }),
  },
];

/**
 * Optional ML contribution collector — only active when raw.mlRiskScore is set.
 * Does not replace the rule engine; contributes an additive signal.
 */
export const ML_RISK_COLLECTOR: SignalCollector = {
  signalKey: "ml_risk_model",
  category: "ml",
  computeNormalized: (raw) => {
    const v = raw.mlRiskScore ?? 0;
    return {
      rawValue: v,
      normalizedValue: clamp01(v),
      metadata: { ml: true, layer: "future" },
    };
  },
};
