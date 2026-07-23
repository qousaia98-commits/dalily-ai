/**
 * Smart Local Matching — product weights (Sprint 28).
 * Premium is intentionally small so quality & proximity dominate.
 * Availability is future-ready (neutral until live data exists).
 */
export const SMART_MATCH_WEIGHTS = {
  distance: 0.28,
  verification: 0.18,
  rating: 0.15,
  completedJobs: 0.12,
  responseTime: 0.1,
  specialization: 0.08,
  premium: 0.05,
  availability: 0.04,
} as const;

export type SmartMatchFactorKey = keyof typeof SMART_MATCH_WEIGHTS;

export type SmartMatchFactorScores = {
  distance: number;
  verification: number;
  rating: number;
  completedJobs: number;
  responseTime: number;
  specialization: number;
  premium: number;
  availability: number;
};

export function combineSmartMatchScore(factors: SmartMatchFactorScores): number {
  return (
    SMART_MATCH_WEIGHTS.distance * factors.distance +
    SMART_MATCH_WEIGHTS.verification * factors.verification +
    SMART_MATCH_WEIGHTS.rating * factors.rating +
    SMART_MATCH_WEIGHTS.completedJobs * factors.completedJobs +
    SMART_MATCH_WEIGHTS.responseTime * factors.responseTime +
    SMART_MATCH_WEIGHTS.specialization * factors.specialization +
    SMART_MATCH_WEIGHTS.premium * factors.premium +
    SMART_MATCH_WEIGHTS.availability * factors.availability
  );
}

/** Legacy snapshot quality ≈ trustworthiness blend (growth / analytics). */
export function deriveLegacyQuality(factors: SmartMatchFactorScores): number {
  return (
    factors.verification * 0.35 +
    factors.rating * 0.25 +
    factors.completedJobs * 0.2 +
    factors.responseTime * 0.2
  );
}

export function deriveLegacyFreshness(factors: SmartMatchFactorScores): number {
  return (factors.specialization + factors.availability) / 2;
}
