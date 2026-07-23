/**
 * Future AI matching hooks — structured extension points.
 * Do not wire live traffic/price APIs until product-ready.
 */

export type FutureMatchSignals = {
  /** 0–1 predicted availability right now */
  availabilityScore?: number | null;
  /** 0–1 lower = more congested route */
  trafficScore?: number | null;
  /** Relative price competitiveness 0–1 */
  priceIntelligenceScore?: number | null;
  /** Emergency dispatch priority boost */
  emergencyBoost?: number | null;
};

export function resolveAvailabilityScore(
  signals?: FutureMatchSignals | null,
): number {
  if (signals?.availabilityScore == null) return 0.55;
  return Math.min(1, Math.max(0, signals.availabilityScore));
}

export function applyFutureBoosts(
  baseScore: number,
  signals?: FutureMatchSignals | null,
): number {
  if (!signals) return baseScore;
  let score = baseScore;
  if (signals.emergencyBoost != null) {
    score += signals.emergencyBoost * 0.05;
  }
  if (signals.trafficScore != null) {
    score = score * 0.95 + signals.trafficScore * 0.05;
  }
  if (signals.priceIntelligenceScore != null) {
    score = score * 0.97 + signals.priceIntelligenceScore * 0.03;
  }
  return Math.min(1, Math.max(0, score));
}
