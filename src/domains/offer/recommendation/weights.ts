/**
 * Configurable offer-decision weights.
 * Defaults live in code; optional DB table `offer_decision_weights` overrides when present.
 * Never expose these weights to clients.
 */

import type { OfferDecisionWeight } from "./types";

export const DEFAULT_OFFER_DECISION_WEIGHTS: OfferDecisionWeight[] = [
  { signalKey: "completed_jobs", category: "experience", weight: 1.0, enabled: true, mlReady: false },
  { signalKey: "rating", category: "quality", weight: 1.3, enabled: true, mlReady: false },
  { signalKey: "review_quality", category: "quality", weight: 0.9, enabled: true, mlReady: true },
  { signalKey: "response_time", category: "behaviour", weight: 1.0, enabled: true, mlReady: false },
  { signalKey: "acceptance_rate", category: "behaviour", weight: 0.8, enabled: true, mlReady: false },
  { signalKey: "cancellation_rate", category: "risk", weight: -0.9, enabled: true, mlReady: false },
  { signalKey: "trust_score", category: "trust", weight: 1.2, enabled: true, mlReady: true },
  { signalKey: "profile_completeness", category: "trust", weight: 0.5, enabled: true, mlReady: false },
  { signalKey: "verification", category: "trust", weight: 1.0, enabled: true, mlReady: false },
  { signalKey: "recent_activity", category: "availability", weight: 0.4, enabled: true, mlReady: false },
  { signalKey: "repeat_customers", category: "behaviour", weight: 0.7, enabled: true, mlReady: true },
  { signalKey: "category_experience", category: "quality", weight: 0.9, enabled: true, mlReady: false },
  { signalKey: "distance", category: "geo", weight: 0.6, enabled: true, mlReady: false },
  { signalKey: "availability", category: "availability", weight: 0.8, enabled: true, mlReady: false },
  { signalKey: "price_value", category: "price", weight: 0.55, enabled: true, mlReady: true },
  { signalKey: "featured_override", category: "ops", weight: 0.25, enabled: true, mlReady: false },
];

export function mergeOfferDecisionWeights(
  defaults: OfferDecisionWeight[],
  overrides: Partial<OfferDecisionWeight>[],
): OfferDecisionWeight[] {
  const map = new Map(defaults.map((d) => [d.signalKey, { ...d }]));
  for (const o of overrides) {
    if (!o.signalKey) continue;
    const prev = map.get(o.signalKey);
    if (prev) map.set(o.signalKey, { ...prev, ...o });
  }
  return [...map.values()];
}
