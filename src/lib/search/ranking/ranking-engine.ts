import type { PlanSlug } from "@/lib/subscription/types";
import { planTierRank } from "@/lib/subscription/limits";
import type { VerificationStatus } from "@/types/database.types";
import type { Database } from "@/types/database.types";
import type { ProblemPriority } from "@/lib/search/engine/types";
import type { SearchSort } from "@/lib/geo/distance";

type ProviderRow = Database["public"]["Tables"]["providers"]["Row"];

/**
 * Single source of truth for Dalily search ranking.
 * Weights are fixed product policy — never duplicate elsewhere.
 *
 * 40% Business Quality | 30% Distance | 20% Subscription | 10% Freshness
 * Quality always wins over subscription alone.
 */
export const RANKING_WEIGHTS = {
  quality: 0.4,
  distance: 0.3,
  subscription: 0.2,
  freshness: 0.1,
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
  combinedScore: number;
  planSlug: PlanSlug;
  distanceKm: number | null;
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
  sort?: SearchSort;
};

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

function verificationScore(status: VerificationStatus): number {
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

/** Business quality only — never includes subscription. */
export function scoreBusinessQuality(
  provider: ProviderRow,
  priority?: ProblemPriority | null,
): number {
  const verification = verificationScore(provider.verification_status);
  const completeness = clamp01(provider.profile_completeness / 100);
  const trust = clamp01(provider.trust_score / 100);
  const rating = clamp01(Number(provider.rating_avg) / 5);
  const reviews = clamp01(Math.log10(1 + provider.review_count) / 2);
  // Health ≈ blend of completeness + trust
  const health = (completeness + trust) / 2;

  let urgency = 0.5;
  if (priority === "emergency" || priority === "high") {
    const responseHours = provider.response_time_hours;
    const responseBoost =
      responseHours == null ? 0.5 : clamp01(1 - responseHours / 48);
    urgency = (verification + responseBoost) / 2;
  }

  // Photos/activity approximated via completeness + updated activity in freshness
  return clamp01(
    verification * 0.28 +
      completeness * 0.22 +
      rating * 0.18 +
      reviews * 0.12 +
      health * 0.12 +
      urgency * 0.08,
  );
}

export function scoreDistance(km: number | null): number {
  if (km == null || !Number.isFinite(km)) return 0.35;
  return clamp01(1 - km / 25);
}

export function scoreSubscription(planSlug: PlanSlug): number {
  const tier = planTierRank(planSlug);
  // Starter 1/3, PRO 2/3, PREMIUM 1 — soft lift, never sole winner
  return clamp01(tier / 3);
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

/**
 * Score every candidate with the canonical weights.
 * Returns ordered RankedCandidate[] (position 1-based after sort).
 */
export function rankCandidates(
  rows: ProviderRow[],
  context: RankingEngineContext = {},
): RankedCandidate[] {
  const sort = context.sort ?? "relevant";

  const scored: RankedCandidate[] = rows.map((provider) => {
    const planSlug = resolvePlan(provider.id, context);
    const distanceKm = context.distanceByProviderId?.get(provider.id) ?? null;
    const factors: RankingFactorScores = {
      quality: scoreBusinessQuality(provider, context.priority),
      distance: scoreDistance(distanceKm),
      subscription: scoreSubscription(planSlug),
      freshness: scoreFreshness(provider),
    };
    return {
      provider,
      factors,
      combinedScore: combineRankingScore(factors),
      planSlug,
      distanceKm,
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
