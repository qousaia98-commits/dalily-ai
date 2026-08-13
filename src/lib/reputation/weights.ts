/**
 * Default weights — overridden by provider_reputation_weights at runtime.
 * Core engine never hardcodes category math; it only multiplies weight × normalized.
 */

import type { SignalWeight } from "@/lib/reputation/types";

export const DEFAULT_REPUTATION_WEIGHTS: SignalWeight[] = [
  { signalKey: "identity_verified", category: "verification", weight: 1.2, enabled: true, mlReady: true },
  { signalKey: "address_verified", category: "verification", weight: 0.8, enabled: true, mlReady: true },
  { signalKey: "business_verified", category: "verification", weight: 1.4, enabled: true, mlReady: true },
  { signalKey: "professional_verified", category: "verification", weight: 1.0, enabled: true, mlReady: true },
  { signalKey: "document_freshness", category: "verification", weight: 0.6, enabled: true, mlReady: true },
  { signalKey: "average_rating", category: "reviews", weight: 1.8, enabled: true, mlReady: true },
  { signalKey: "review_count", category: "reviews", weight: 1.0, enabled: true, mlReady: true },
  { signalKey: "recommendation_rate", category: "reviews", weight: 1.2, enabled: true, mlReady: true },
  { signalKey: "recent_reviews", category: "reviews", weight: 1.1, enabled: true, mlReady: true },
  { signalKey: "provider_response_rate", category: "reviews", weight: 0.9, enabled: true, mlReady: true },
  { signalKey: "review_quality", category: "reviews", weight: 0.7, enabled: true, mlReady: true },
  { signalKey: "completed_jobs", category: "booking", weight: 1.3, enabled: true, mlReady: true },
  { signalKey: "cancelled_jobs", category: "booking", weight: 0.8, enabled: true, mlReady: true },
  { signalKey: "cancellation_rate", category: "booking", weight: 1.1, enabled: true, mlReady: true },
  { signalKey: "acceptance_rate", category: "booking", weight: 1.0, enabled: true, mlReady: true },
  { signalKey: "completion_rate", category: "booking", weight: 1.4, enabled: true, mlReady: true },
  { signalKey: "repeat_customers", category: "booking", weight: 1.0, enabled: true, mlReady: true },
  { signalKey: "avg_booking_value", category: "booking", weight: 0.4, enabled: true, mlReady: true },
  { signalKey: "avg_response_time", category: "communication", weight: 1.3, enabled: true, mlReady: true },
  { signalKey: "response_consistency", category: "communication", weight: 0.8, enabled: true, mlReady: true },
  { signalKey: "unread_requests", category: "communication", weight: 0.7, enabled: true, mlReady: true },
  { signalKey: "late_replies", category: "communication", weight: 0.6, enabled: true, mlReady: true },
  { signalKey: "on_time_arrival", category: "reliability", weight: 1.0, enabled: true, mlReady: true },
  { signalKey: "customer_confirmations", category: "reliability", weight: 0.9, enabled: true, mlReady: true },
  { signalKey: "complaint_rate", category: "reliability", weight: 1.2, enabled: true, mlReady: true },
  { signalKey: "refund_rate", category: "reliability", weight: 0.9, enabled: true, mlReady: true },
  { signalKey: "disputes", category: "reliability", weight: 1.0, enabled: true, mlReady: true },
  { signalKey: "policy_violations", category: "reliability", weight: 1.1, enabled: true, mlReady: true },
  { signalKey: "profile_completeness", category: "activity", weight: 0.8, enabled: true, mlReady: true },
  { signalKey: "recent_activity", category: "activity", weight: 0.9, enabled: true, mlReady: true },
  { signalKey: "login_frequency", category: "activity", weight: 0.4, enabled: true, mlReady: true },
  { signalKey: "business_age", category: "activity", weight: 0.5, enabled: true, mlReady: true },
  { signalKey: "marketplace_engagement", category: "activity", weight: 0.7, enabled: true, mlReady: true },
];

export function mergeWeights(
  dbRows: Array<{
    signal_key: string;
    category: string;
    weight: number;
    enabled: boolean;
    ml_ready: boolean;
    description?: string | null;
  }> | null,
): SignalWeight[] {
  if (!dbRows || dbRows.length === 0) return DEFAULT_REPUTATION_WEIGHTS;
  const byKey = new Map(dbRows.map((r) => [r.signal_key, r]));
  return DEFAULT_REPUTATION_WEIGHTS.map((def) => {
    const row = byKey.get(def.signalKey);
    if (!row) return def;
    return {
      signalKey: def.signalKey,
      category: def.category,
      weight: Number(row.weight),
      enabled: row.enabled,
      mlReady: row.ml_ready,
      description: row.description,
    };
  });
}
