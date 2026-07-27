/**
 * Configurable matching weights — DB overrides defaults.
 */

import type { MatchWeight } from "@/lib/matching-engine/types";

export const DEFAULT_MATCHING_WEIGHTS: MatchWeight[] = [
  { signalKey: "distance", category: "geo", weight: 1.5, enabled: true, mlReady: false },
  { signalKey: "travel_time", category: "geo", weight: 0.8, enabled: true, mlReady: true },
  { signalKey: "availability", category: "availability", weight: 1.2, enabled: true, mlReady: false },
  { signalKey: "workload", category: "availability", weight: 0.9, enabled: true, mlReady: true },
  { signalKey: "reputation", category: "reputation", weight: 1.1, enabled: true, mlReady: true },
  { signalKey: "trust_level", category: "reputation", weight: 0.7, enabled: true, mlReady: false },
  { signalKey: "verification", category: "identity", weight: 1.0, enabled: true, mlReady: false },
  { signalKey: "category_expertise", category: "quality", weight: 1.2, enabled: true, mlReady: false },
  { signalKey: "experience", category: "quality", weight: 0.7, enabled: true, mlReady: false },
  { signalKey: "completed_jobs", category: "behaviour", weight: 0.8, enabled: true, mlReady: false },
  { signalKey: "repeat_customers", category: "behaviour", weight: 0.6, enabled: true, mlReady: true },
  { signalKey: "response_time", category: "behaviour", weight: 0.9, enabled: true, mlReady: false },
  { signalKey: "acceptance_rate", category: "behaviour", weight: 0.9, enabled: true, mlReady: false },
  { signalKey: "completion_rate", category: "behaviour", weight: 0.9, enabled: true, mlReady: false },
  { signalKey: "cancellation_rate", category: "behaviour", weight: -0.7, enabled: true, mlReady: false },
  { signalKey: "recommendation_rate", category: "behaviour", weight: 0.5, enabled: true, mlReady: true },
  { signalKey: "review_quality", category: "quality", weight: 1.0, enabled: true, mlReady: true },
  { signalKey: "recent_activity", category: "availability", weight: 0.4, enabled: true, mlReady: false },
  { signalKey: "business_hours", category: "availability", weight: 0.5, enabled: true, mlReady: false },
  { signalKey: "languages", category: "preference", weight: 0.4, enabled: true, mlReady: false },
  { signalKey: "price_competitiveness", category: "price", weight: 0.6, enabled: true, mlReady: true },
  { signalKey: "quality_cases", category: "risk", weight: -0.8, enabled: true, mlReady: false },
  { signalKey: "fraud_risk", category: "risk", weight: -1.2, enabled: true, mlReady: true },
  { signalKey: "customer_preferences", category: "preference", weight: 0.7, enabled: true, mlReady: true },
  { signalKey: "preferred_history", category: "preference", weight: 0.8, enabled: true, mlReady: false },
  { signalKey: "favourite_providers", category: "preference", weight: 1.0, enabled: true, mlReady: false },
  { signalKey: "fairness_exploration", category: "fairness", weight: 0.35, enabled: true, mlReady: false },
  { signalKey: "ml_ranker", category: "ml", weight: 1.0, enabled: true, mlReady: true },
];

export function mergeMatchingWeights(
  defaults: MatchWeight[],
  overrides: Partial<MatchWeight>[],
): MatchWeight[] {
  const map = new Map(defaults.map((d) => [d.signalKey, { ...d }]));
  for (const o of overrides) {
    if (!o.signalKey) continue;
    const prev = map.get(o.signalKey);
    if (prev) map.set(o.signalKey, { ...prev, ...o });
  }
  return [...map.values()];
}
