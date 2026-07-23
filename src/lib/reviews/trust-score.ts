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

/** Pure TS mirror of DB recompute_provider_trust_score (for UI / tests). */
export function calculateTrustScore(input: TrustScoreInput): number {
  const avg = Math.min(5, Math.max(0, input.ratingAvg || 0));
  const count = Math.max(0, input.reviewCount || 0);
  const verified = Math.max(0, input.verifiedReviewCount || 0);
  const helpful = Math.max(0, input.helpfulVotesTotal || 0);
  const completed = Math.max(0, input.completedJobs || 0);

  let score = 0;
  score += Math.min(40, (avg / 5) * 40);
  score += Math.min(20, Math.log(1 + count) * 6.5);
  if (count > 0) score += (verified / count) * 15;
  score += Math.min(10, Math.log(1 + helpful) * 3.5);

  if (input.verificationStatus === "verified") score += 10;
  else if (input.verificationStatus === "partially_verified") score += 5;

  score += Math.min(5, Math.log(1 + completed) * 1.6);

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
