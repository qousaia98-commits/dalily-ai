import type { PlanSlug } from "@/lib/subscription/types";
import { planTierRank } from "@/lib/subscription/limits";
import type { VerificationStatus } from "@/types/database.types";
import type { Database } from "@/types/database.types";
import type { ProblemPriority } from "@/lib/search/engine/types";
import type { SearchSort } from "@/lib/geo/distance";
import {
  combineSmartMatchScore,
  deriveLegacyFreshness,
  deriveLegacyQuality,
  type SmartMatchFactorScores,
} from "@/lib/search/smart-match/weights";
import {
  applyFutureBoosts,
  resolveAvailabilityScore,
  type FutureMatchSignals,
} from "@/lib/search/smart-match/future-hooks";

type ProviderRow = Database["public"]["Tables"]["providers"]["Row"];

/**
 * Legacy 4-factor snapshot weights — packed from Smart Match factors.
 * Live ranking uses Smart Match (see combineSmartMatchScore).
 * Growth simulation still uses these via rerankSnapshotWithPlan.
 *
 * quality 55% | distance 28% | subscription/premium 5% | freshness 12%
 */
export const RANKING_WEIGHTS = {
  quality: 0.55,
  distance: 0.28,
  subscription: 0.05,
  freshness: 0.12,
} as const;

export type RankingFactorScores = {
  quality: number;
  distance: number;
  subscription: number;
  freshness: number;
};

export type RankedCandidate = {
  provider: ProviderRow;
  factors: RankingFactorScores;
  smartFactors: SmartMatchFactorScores;
  combinedScore: number;
  planSlug: PlanSlug;
  distanceKm: number | null;
  completedJobs: number;
  position: number;
};

export type RankingSnapshotEntry = {
  id: string;
  position: number;
  score: number;
  quality: number;
  distance: number;
  subscription: number;
  freshness: number;
  plan: PlanSlug;
  distanceKm: number | null;
};

export type RankingEngineContext = {
  priority?: ProblemPriority | null;
  planSlugsByProviderId?: Map<string, PlanSlug>;
  /** Force a plan override for one provider (growth simulation). */
  planOverrideByProviderId?: Map<string, PlanSlug>;
  distanceByProviderId?: Map<string, number | null>;
  completedJobsByProviderId?: Map<string, number>;
  /** Target category for specialization boost */
  targetCategorySlug?: string | null;
  categorySlugByProviderId?: Map<string, string>;
  /** Adaptive distance scale (km) — defaults to 25 */
  radiusKm?: number | null;
  futureSignalsByProviderId?: Map<string, FutureMatchSignals>;
  sort?: SearchSort;
};

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

export function scoreVerification(status: VerificationStatus): number {
  switch (status) {
    case "verified":
      return 1;
    case "partially_verified":
      return 0.75;
    case "pending":
      return 0.5;
    case "unverified":
      return 0.25;
    default:
      return 0;
  }
}

export function scoreRating(provider: ProviderRow): number {
  const rating = clamp01(Number(provider.rating_avg) / 5);
  const reviews = clamp01(Math.log10(1 + provider.review_count) / 2);
  return clamp01(rating * 0.75 + reviews * 0.25);
}

export function scoreCompletedJobs(count: number): number {
  if (count <= 0) return 0.15;
  return clamp01(Math.log10(1 + count) / 2.5);
}

export function scoreResponseTime(
  hours: number | null,
  priority?: ProblemPriority | null,
): number {
  if (hours == null) return 0.45;
  const base = clamp01(1 - hours / 48);
  if (priority === "emergency" || priority === "high") {
    return clamp01(base * 1.1);
  }
  return base;
}

export function scoreSpecialization(
  matchesTarget: boolean,
  profileCompleteness: number,
): number {
  // Category match dominates. Completeness is only a small positive bonus —
  // missing photos must not tank ranking (completeness is media-light).
  const base = matchesTarget ? 0.82 : 0.4;
  const richnessBonus = clamp01(profileCompleteness / 100) * 0.12;
  return clamp01(base + richnessBonus);
}

/** Premium / plan lift — intentionally small in Smart Match. */
export function scoreSubscription(planSlug: PlanSlug): number {
  const tier = planTierRank(planSlug);
  return clamp01(tier / 3);
}

export function scoreDistance(km: number | null, radiusKm?: number | null): number {
  if (km == null || !Number.isFinite(km)) return 0.35;
  const scale = radiusKm && radiusKm > 0 ? radiusKm * 1.2 : 25;
  return clamp01(1 - km / scale);
}

/**
 * Legacy quality helper — verification + rating blend.
 * Prefer Smart Match factors for new code.
 */
export function scoreBusinessQuality(
  provider: ProviderRow,
  priority?: ProblemPriority | null,
): number {
  const verification = scoreVerification(provider.verification_status);
  const rating = scoreRating(provider);
  const response = scoreResponseTime(provider.response_time_hours, priority);
  const completeness = clamp01(provider.profile_completeness / 100);
  const trust = clamp01(provider.trust_score / 100);
  return clamp01(
    verification * 0.38 +
      rating * 0.32 +
      response * 0.2 +
      // Small profile richness signal — never dominated by media gaps
      ((completeness + trust) / 2) * 0.1,
  );
}

export function scoreFreshness(provider: ProviderRow): number {
  const updatedMs = Date.now() - new Date(provider.updated_at).getTime();
  const createdMs = Date.now() - new Date(provider.created_at).getTime();
  const updatedDays = updatedMs / (1000 * 60 * 60 * 24);
  const createdDays = createdMs / (1000 * 60 * 60 * 24);
  const updateScore = clamp01(1 - updatedDays / 90);
  const newnessScore = clamp01(1 - createdDays / 365);
  return clamp01(updateScore * 0.7 + newnessScore * 0.3);
}

export function combineRankingScore(factors: RankingFactorScores): number {
  return (
    RANKING_WEIGHTS.quality * factors.quality +
    RANKING_WEIGHTS.distance * factors.distance +
    RANKING_WEIGHTS.subscription * factors.subscription +
    RANKING_WEIGHTS.freshness * factors.freshness
  );
}

function resolvePlan(
  providerId: string,
  context: RankingEngineContext,
): PlanSlug {
  return (
    context.planOverrideByProviderId?.get(providerId) ??
    context.planSlugsByProviderId?.get(providerId) ??
    "free"
  );
}

function buildSmartFactors(
  provider: ProviderRow,
  context: RankingEngineContext,
  planSlug: PlanSlug,
  distanceKm: number | null,
  completedJobs: number,
): SmartMatchFactorScores {
  const providerCategory = context.categorySlugByProviderId?.get(provider.id);
  const matchesTarget = Boolean(
    context.targetCategorySlug &&
      providerCategory &&
      providerCategory === context.targetCategorySlug,
  );
  const signals = context.futureSignalsByProviderId?.get(provider.id);

  return {
    distance: scoreDistance(distanceKm, context.radiusKm),
    verification: scoreVerification(provider.verification_status),
    rating: scoreRating(provider),
    completedJobs: scoreCompletedJobs(completedJobs),
    responseTime: scoreResponseTime(provider.response_time_hours, context.priority),
    specialization: scoreSpecialization(matchesTarget, provider.profile_completeness),
    premium: scoreSubscription(planSlug),
    availability: resolveAvailabilityScore(signals),
  };
}

/**
 * Score every candidate with Smart Match weights.
 * Snapshot factors stay 4-field for growth / analytics compatibility.
 */
export function rankCandidates(
  rows: ProviderRow[],
  context: RankingEngineContext = {},
): RankedCandidate[] {
  const sort = context.sort ?? "relevant";

  const scored: RankedCandidate[] = rows.map((provider) => {
    const planSlug = resolvePlan(provider.id, context);
    const distanceKm = context.distanceByProviderId?.get(provider.id) ?? null;
    const completedJobs = context.completedJobsByProviderId?.get(provider.id) ?? 0;
    const smartFactors = buildSmartFactors(
      provider,
      context,
      planSlug,
      distanceKm,
      completedJobs,
    );
    const factors: RankingFactorScores = {
      quality: deriveLegacyQuality(smartFactors),
      distance: smartFactors.distance,
      subscription: smartFactors.premium,
      freshness: deriveLegacyFreshness(smartFactors),
    };
    const signals = context.futureSignalsByProviderId?.get(provider.id);
    const combinedScore = applyFutureBoosts(
      combineSmartMatchScore(smartFactors),
      signals,
    );
    return {
      provider,
      factors,
      smartFactors,
      combinedScore,
      planSlug,
      distanceKm,
      completedJobs,
      position: 0,
    };
  });

  scored.sort((a, b) => {
    if (sort === "nearest") {
      const da = a.distanceKm ?? Number.POSITIVE_INFINITY;
      const db = b.distanceKm ?? Number.POSITIVE_INFINITY;
      if (da !== db) return da - db;
      return b.combinedScore - a.combinedScore;
    }
    if (sort === "rating") {
      if (Number(b.provider.rating_avg) !== Number(a.provider.rating_avg)) {
        return Number(b.provider.rating_avg) - Number(a.provider.rating_avg);
      }
      return b.provider.review_count - a.provider.review_count;
    }
    if (sort === "newest") {
      return (
        new Date(b.provider.created_at).getTime() -
        new Date(a.provider.created_at).getTime()
      );
    }
    if (sort === "pro") {
      const aPro = planTierRank(a.planSlug) >= 2 ? 1 : 0;
      const bPro = planTierRank(b.planSlug) >= 2 ? 1 : 0;
      if (bPro !== aPro) return bPro - aPro;
      return b.combinedScore - a.combinedScore;
    }
    if (sort === "premium") {
      const aPrem = planTierRank(a.planSlug) >= 3 ? 1 : 0;
      const bPrem = planTierRank(b.planSlug) >= 3 ? 1 : 0;
      if (bPrem !== aPrem) return bPrem - aPrem;
      return b.combinedScore - a.combinedScore;
    }

    if (b.combinedScore !== a.combinedScore) return b.combinedScore - a.combinedScore;
    if (b.factors.quality !== a.factors.quality) return b.factors.quality - a.factors.quality;
    if (b.completedJobs !== a.completedJobs) return b.completedJobs - a.completedJobs;
    if (b.provider.review_count !== a.provider.review_count) {
      return b.provider.review_count - a.provider.review_count;
    }
    return new Date(b.provider.updated_at).getTime() - new Date(a.provider.updated_at).getTime();
  });

  return scored.map((item, index) => ({ ...item, position: index + 1 }));
}

export function toRankingSnapshot(candidates: RankedCandidate[]): RankingSnapshotEntry[] {
  return candidates.map((c) => ({
    id: c.provider.id,
    position: c.position,
    score: Math.round(c.combinedScore * 10000) / 10000,
    quality: Math.round(c.factors.quality * 10000) / 10000,
    distance: Math.round(c.factors.distance * 10000) / 10000,
    subscription: Math.round(c.factors.subscription * 10000) / 10000,
    freshness: Math.round(c.factors.freshness * 10000) / 10000,
    plan: c.planSlug,
    distanceKm: c.distanceKm,
  }));
}

/**
 * Re-rank a stored snapshot with a plan override for one business.
 * Uses the SAME combineRankingScore — never invents percentages.
 */
export function rerankSnapshotWithPlan(
  snapshot: RankingSnapshotEntry[],
  providerId: string,
  simulatedPlan: PlanSlug,
): RankingSnapshotEntry[] {
  const rescored = snapshot.map((entry) => {
    const subscription =
      entry.id === providerId ? scoreSubscription(simulatedPlan) : entry.subscription;
    const plan = entry.id === providerId ? simulatedPlan : entry.plan;
    const score = combineRankingScore({
      quality: entry.quality,
      distance: entry.distance,
      subscription,
      freshness: entry.freshness,
    });
    return { ...entry, subscription, plan, score };
  });

  rescored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.quality !== a.quality) return b.quality - a.quality;
    return a.position - b.position;
  });

  return rescored.map((entry, index) => ({ ...entry, position: index + 1 }));
}

export function appearsInTopN(
  snapshot: RankingSnapshotEntry[],
  providerId: string,
  topN: number,
): boolean {
  const entry = snapshot.find((s) => s.id === providerId);
  return Boolean(entry && entry.position <= topN);
}
