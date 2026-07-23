/**
 * Inject Dalily Ranking after Smart Match (+ Learning), before final cut.
 * Does not replace Smart Match — blends scores on `relevant` sort.
 */

import type { RankedCandidate } from "@/lib/search/ranking/ranking-engine";
import type { SearchSort } from "@/lib/geo/distance";
import type { ProviderPerformanceRow } from "@/lib/search/learning/types";
import { calculateDalilyScore } from "@/lib/dalily-ranking/score-calculator";
import { buildRecommendationBadges } from "@/lib/dalily-ranking/recommendation-engine";
import { explainDalilyScore } from "@/lib/dalily-ranking/explanation";
import type {
  DalilyScoreBreakdown,
  RankingExplanation,
  RecommendationBadge,
  ScoreCalculatorInput,
} from "@/lib/dalily-ranking/types";
import type { DalilyWeightMap } from "@/lib/dalily-ranking/weights";

export type DalilyRankedCandidate = RankedCandidate & {
  dalilyBreakdown: DalilyScoreBreakdown;
  recommendationBadges: RecommendationBadge[];
  rankingExplanation: RankingExplanation;
};

export type ApplyDalilyRankingInput = {
  candidates: RankedCandidate[];
  sort?: SearchSort;
  performanceByProviderId?: Map<string, ProviderPerformanceRow>;
  targetCategorySlug?: string | null;
  categorySlugByProviderId?: Map<string, string>;
  radiusKm?: number | null;
  weightOverrides?: Partial<DalilyWeightMap> | null;
  /** When false, attach scores but do not re-sort */
  resort?: boolean;
};

function toCalculatorInput(
  c: RankedCandidate,
  perf: ProviderPerformanceRow | undefined,
  input: ApplyDalilyRankingInput,
): ScoreCalculatorInput {
  const cat = input.categorySlugByProviderId?.get(c.provider.id);
  return {
    providerId: c.provider.id,
    ratingAvg: Number(c.provider.rating_avg) || 0,
    reviewCount: c.provider.review_count ?? 0,
    trustScore: c.provider.trust_score ?? 0,
    verificationStatus: c.provider.verification_status,
    profileCompleteness: c.provider.profile_completeness ?? 0,
    responseTimeHours: c.provider.response_time_hours,
    completedJobs: c.completedJobs,
    distanceKm: c.distanceKm,
    radiusKm: input.radiusKm,
    availabilityHint: c.smartFactors?.availability ?? null,
    acceptanceRate: perf?.acceptanceRate ?? null,
    completionRate: perf?.completionRate ?? null,
    cancellationRate: perf?.cancellationRate ?? null,
    updatedAt: c.provider.updated_at ?? null,
    createdAt: c.provider.created_at ?? null,
    matchesCategory: Boolean(
      input.targetCategorySlug && cat && cat === input.targetCategorySlug,
    ),
    planIsPremium: c.planSlug === "premium" || c.planSlug === "pro",
  };
}

export function applyDalilyRankingLayer(
  input: ApplyDalilyRankingInput,
): {
  candidates: DalilyRankedCandidate[];
  breakdownByProviderId: Map<string, DalilyScoreBreakdown>;
} {
  const breakdownByProviderId = new Map<string, DalilyScoreBreakdown>();
  const sort = input.sort ?? "relevant";
  const shouldBlend = sort === "relevant";

  let enriched: DalilyRankedCandidate[] = input.candidates.map((c) => {
    const perf = input.performanceByProviderId?.get(c.provider.id);
    const calcInput = toCalculatorInput(c, perf, input);
    const breakdown = calculateDalilyScore(calcInput, {
      weights: input.weightOverrides,
      smartMatchScore: c.combinedScore,
      blendWithSmartMatch: shouldBlend,
    });
    breakdownByProviderId.set(c.provider.id, breakdown);

    const badges = buildRecommendationBadges({
      breakdown,
      calculatorInput: calcInput,
      max: 3,
    });
    const explanation = explainDalilyScore({
      breakdown,
      badges,
      position: c.position,
    });

    const nextScore = shouldBlend ? breakdown.finalScore : c.combinedScore;

    return {
      ...c,
      combinedScore: nextScore,
      dalilyBreakdown: breakdown,
      recommendationBadges: badges,
      rankingExplanation: explanation,
    };
  });

  if (input.resort !== false && shouldBlend) {
    enriched = [...enriched].sort((a, b) => {
      if (b.combinedScore !== a.combinedScore) return b.combinedScore - a.combinedScore;
      if (b.dalilyBreakdown.overall !== a.dalilyBreakdown.overall) {
        return b.dalilyBreakdown.overall - a.dalilyBreakdown.overall;
      }
      return a.position - b.position;
    });
    enriched = enriched.map((c, i) => ({
      ...c,
      position: i + 1,
      rankingExplanation: { ...c.rankingExplanation, position: i + 1 },
    }));
  }

  return { candidates: enriched, breakdownByProviderId };
}
