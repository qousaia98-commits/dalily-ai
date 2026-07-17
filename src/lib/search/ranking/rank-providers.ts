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
  sort?: SearchSort;
};

export type RankProvidersResult = {
  providers: ProviderRow[];
  candidates: RankedCandidate[];
  snapshot: RankingSnapshotEntry[];
};

/**
 * Canonical ranking entry — delegates to ranking-engine (single algorithm).
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

  const candidates = rankCandidates(rows, {
    priority: context.priority,
    planSlugsByProviderId: planMap,
    planOverrideByProviderId: context.planOverrideByProviderId,
    distanceByProviderId: context.distanceByProviderId,
    sort: context.sort,
  });

  return {
    providers: candidates.map((c) => c.provider),
    candidates,
    snapshot: toRankingSnapshot(candidates),
  };
}

/** Back-compat wrapper — same algorithm as rankProvidersDetailed. */
export function rankProviders(
  rows: ProviderRow[],
  context: RankProvidersContext = {},
): ProviderRow[] {
  return rankProvidersDetailed(rows, context).providers;
}
