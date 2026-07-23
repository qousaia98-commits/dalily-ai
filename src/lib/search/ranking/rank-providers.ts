import type { PlanSlug } from "@/lib/subscription/types";
import type { Database } from "@/types/database.types";
import type { ProblemPriority } from "@/lib/search/engine/types";
import type { SearchSort } from "@/lib/geo/distance";
import {
  rankCandidates,
  type RankedCandidate,
  type RankingSnapshotEntry,
  toRankingSnapshot,
} from "@/lib/search/ranking/ranking-engine";
import { applyLearningLayer } from "@/lib/search/learning/layer";
import type {
  CustomerPreferenceProfile,
  MatchConfidence,
  ProviderPerformanceRow,
} from "@/lib/search/learning/types";

type ProviderRow = Database["public"]["Tables"]["providers"]["Row"];

export type ScoredProvider = {
  provider: ProviderRow;
  dalilyScore: number;
  planTier: number;
  distanceKm: number | null;
  combinedScore: number;
};

export type RankProvidersContext = {
  priority?: ProblemPriority | null;
  planSlug?: PlanSlug;
  planSlugsByProviderId?: Map<string, PlanSlug>;
  planOverrideByProviderId?: Map<string, PlanSlug>;
  userLat?: number | null;
  userLng?: number | null;
  distanceByProviderId?: Map<string, number | null>;
  completedJobsByProviderId?: Map<string, number>;
  targetCategorySlug?: string | null;
  categorySlugByProviderId?: Map<string, string>;
  radiusKm?: number | null;
  sort?: SearchSort;
  /** Sprint 29 Learning Layer — optional */
  performanceByProviderId?: Map<string, ProviderPerformanceRow>;
  customerPreferences?: CustomerPreferenceProfile | null;
  applyLearning?: boolean;
};

export type RankProvidersResult = {
  providers: ProviderRow[];
  candidates: RankedCandidate[];
  snapshot: RankingSnapshotEntry[];
  confidenceByProviderId?: Map<string, MatchConfidence | null>;
};

/**
 * Canonical ranking entry — Smart Match first, then optional Learning Layer.
 */
export function rankProvidersDetailed(
  rows: ProviderRow[],
  context: RankProvidersContext = {},
): RankProvidersResult {
  const planMap = new Map(context.planSlugsByProviderId);
  if (context.planSlug) {
    for (const row of rows) {
      if (!planMap.has(row.id)) planMap.set(row.id, context.planSlug);
    }
  }

  let candidates = rankCandidates(rows, {
    priority: context.priority,
    planSlugsByProviderId: planMap,
    planOverrideByProviderId: context.planOverrideByProviderId,
    distanceByProviderId: context.distanceByProviderId,
    completedJobsByProviderId: context.completedJobsByProviderId,
    targetCategorySlug: context.targetCategorySlug,
    categorySlugByProviderId: context.categorySlugByProviderId,
    radiusKm: context.radiusKm,
    sort: context.sort,
  });

  let confidenceByProviderId: Map<string, MatchConfidence | null> | undefined;

  if (context.applyLearning !== false && context.performanceByProviderId) {
    const learned = applyLearningLayer(candidates, {
      performanceByProviderId: context.performanceByProviderId,
      preferences: context.customerPreferences,
      sort: context.sort,
    });
    candidates = learned.candidates;
    confidenceByProviderId = learned.confidenceByProviderId;
  }

  return {
    providers: candidates.map((c) => c.provider),
    candidates,
    snapshot: toRankingSnapshot(candidates),
    confidenceByProviderId,
  };
}

/** Back-compat wrapper — same algorithm as rankProvidersDetailed. */
export function rankProviders(
  rows: ProviderRow[],
  context: RankProvidersContext = {},
): ProviderRow[] {
  return rankProvidersDetailed(rows, context).providers;
}
