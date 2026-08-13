/**
 * Trust Score — reusable, subscription-agnostic.
 * Premium plans must never influence this score.
 */

export type TrustScoreInput = {
  ratingAvg: number;
  reviewCount: number;
  verifiedReviewCount: number;
  helpfulVotesTotal: number;
  verificationStatus: string;
  completedJobs: number;
  /** 0–1 share of reviews that recommend the provider */
  recommendationRate?: number;
  /** 0–1 share of reviews with a provider reply */
  responseRate?: number;
  /** Recency-weighted average (last ~180 days), falls back to ratingAvg */
  recentRatingAvg?: number;
  /** Relative review-quality signal 0–1 (length, dimensions, photos) */
  reviewQuality?: number;
  /** Complaint / dispute rate 0–1 (penalizes score) */
  complaintRate?: number;
};

export type TrustBadgeId =
  | "top_rated"
  | "highly_recommended"
  | "fast_response"
  | "verified"
  | "emergency_available"
  | "experienced";

export type TrustBadgeContext = {
  ratingAvg: number;
  reviewCount: number;
  trustScore: number;
  verified: boolean;
  responseTimeHours: number | null;
  completedJobs: number;
  /** Search/diagnosis context — emergency category demand */
  emergencyContext?: boolean;
};

/**
 * Pure TS mirror of DB recompute_provider_trust_score (for UI / tests).
 * Weights recent ratings higher; recommendation & response rates included.
 * Calculation remains internal — never expose formula to customers.
 */
export function calculateTrustScore(input: TrustScoreInput): number {
  const avg = Math.min(5, Math.max(0, input.ratingAvg || 0));
  const recent = Math.min(
    5,
    Math.max(0, (input.recentRatingAvg ?? input.ratingAvg) || 0),
  );
  const count = Math.max(0, input.reviewCount || 0);
  const verified = Math.max(0, input.verifiedReviewCount || 0);
  const helpful = Math.max(0, input.helpfulVotesTotal || 0);
  const completed = Math.max(0, input.completedJobs || 0);

  let score = 0;
  // Recency-weighted average (40% lifetime + 60% recent)
  score += Math.min(40, ((avg * 0.4 + recent * 0.6) / 5) * 40);
  score += Math.min(18, Math.log(1 + count) * 6);
  if (count > 0) {
    score += (verified / count) * 12;
    if (input.recommendationRate != null) {
      score += Math.min(1, Math.max(0, input.recommendationRate)) * 8;
    }
    if (input.responseRate != null) {
      score += Math.min(1, Math.max(0, input.responseRate)) * 6;
    }
  }
  score += Math.min(8, Math.log(1 + helpful) * 3);

  if (input.verificationStatus === "verified") score += 10;
  else if (input.verificationStatus === "partially_verified") score += 5;

  score += Math.min(5, Math.log(1 + completed) * 1.6);

  if (input.reviewQuality != null) {
    score += Math.min(1, Math.max(0, input.reviewQuality)) * 4;
  }
  if (input.complaintRate != null) {
    score -= Math.min(1, Math.max(0, input.complaintRate)) * 8;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

export function resolveTrustBadges(ctx: TrustBadgeContext): TrustBadgeId[] {
  const badges: TrustBadgeId[] = [];
  if (ctx.verified) badges.push("verified");
  if (ctx.ratingAvg >= 4.7 && ctx.reviewCount >= 8) badges.push("top_rated");
  if (ctx.trustScore >= 75 && ctx.reviewCount >= 5) badges.push("highly_recommended");
  if (ctx.responseTimeHours != null && ctx.responseTimeHours <= 2) {
    badges.push("fast_response");
  }
  if (ctx.completedJobs >= 15) badges.push("experienced");
  if (ctx.emergencyContext) badges.push("emergency_available");
  return badges;
}

export type RatingDistribution = {
  1: number;
  2: number;
  3: number;
  4: number;
  5: number;
  total: number;
};

export function emptyRatingDistribution(): RatingDistribution {
  return { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, total: 0 };
}

export function buildRatingDistribution(ratings: number[]): RatingDistribution {
  const dist = emptyRatingDistribution();
  for (const rating of ratings) {
    const key = Math.min(5, Math.max(1, Math.round(rating))) as 1 | 2 | 3 | 4 | 5;
    dist[key] += 1;
    dist.total += 1;
  }
  return dist;
}
