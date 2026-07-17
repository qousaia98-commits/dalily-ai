import { createAdminClient } from "@/lib/supabase/admin";
import { SEARCH_TOP_N } from "@/lib/search/engine/types";
import {
  appearsInTopN,
  rerankSnapshotWithPlan,
  type RankingSnapshotEntry,
} from "@/lib/search/ranking/ranking-engine";
import {
  hasRankingSnapshotColumn,
  isMissingColumnError,
} from "@/lib/search/schema-capabilities";
import type { PlanSlug } from "@/lib/subscription/types";

export type GrowthPotentialResult = {
  categorySearches: number;
  currentAppearances: number;
  proAppearances: number;
  premiumAppearances: number;
  snapshotsUsed: number;
  /** True when DB has no snapshot column or zero usable snapshots */
  unavailable: boolean;
};

const EMPTY: GrowthPotentialResult = {
  categorySearches: 0,
  currentAppearances: 0,
  proAppearances: 0,
  premiumAppearances: 0,
  snapshotsUsed: 0,
  unavailable: true,
};

function parseSnapshot(raw: unknown): RankingSnapshotEntry[] {
  if (!Array.isArray(raw) || raw.length === 0) return [];
  const out: RankingSnapshotEntry[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    if (typeof row.id !== "string") continue;
    out.push({
      id: row.id,
      position: typeof row.position === "number" ? row.position : 0,
      score: typeof row.score === "number" ? row.score : 0,
      quality: typeof row.quality === "number" ? row.quality : 0,
      distance: typeof row.distance === "number" ? row.distance : 0.35,
      subscription: typeof row.subscription === "number" ? row.subscription : 0,
      freshness: typeof row.freshness === "number" ? row.freshness : 0,
      plan: (row.plan as PlanSlug) ?? "free",
      distanceKm: typeof row.distanceKm === "number" ? row.distanceKm : null,
    });
  }
  return out;
}

/**
 * Growth Potential Engine — never throws; zero/unavailable is valid.
 */
export async function calculateGrowthPotential(input: {
  providerId: string;
  categorySlug: string | null;
  citySlug?: string | null;
  topN?: number;
}): Promise<GrowthPotentialResult> {
  try {
    const topN = input.topN ?? SEARCH_TOP_N;
    const admin = createAdminClient();
    const weekAgo = new Date();
    weekAgo.setUTCDate(weekAgo.getUTCDate() - 7);
    const since = weekAgo.toISOString();

    const useSnapshots = await hasRankingSnapshotColumn();

    let query = useSnapshots
      ? admin
          .from("search_logs")
          .select("id, provider_ids, ranking_snapshot, category_slug")
          .gte("created_at", since)
          .limit(3000)
      : admin
          .from("search_logs")
          .select("id, provider_ids, category_slug")
          .gte("created_at", since)
          .limit(3000);

    if (input.categorySlug) {
      query = query.eq("category_slug", input.categorySlug);
    }

    const { data: logs, error } = await query;

    if (error) {
      if (isMissingColumnError(error)) {
        // Retry without snapshot column
        let fallback = admin
          .from("search_logs")
          .select("id, provider_ids, category_slug")
          .gte("created_at", since)
          .limit(3000);
        if (input.categorySlug) {
          fallback = fallback.eq("category_slug", input.categorySlug);
        }
        const { data: legacy, error: legacyError } = await fallback;
        if (legacyError) {
          console.error("[growth-potential] legacy fallback:", legacyError.message);
          return EMPTY;
        }
        return countLegacyAppearances(legacy ?? [], input.providerId);
      }
      console.error("[growth-potential]", error.message);
      return EMPTY;
    }

    const rows = logs ?? [];
    if (!useSnapshots) {
      return countLegacyAppearances(rows, input.providerId);
    }

    let currentAppearances = 0;
    let proAppearances = 0;
    let premiumAppearances = 0;
    let snapshotsUsed = 0;

    for (const log of rows) {
      const snapshot = parseSnapshot(
        (log as { ranking_snapshot?: unknown }).ranking_snapshot,
      );

      if (snapshot.length > 0) {
        snapshotsUsed += 1;
        const hasTarget = snapshot.some((s) => s.id === input.providerId);
        if (!hasTarget) continue;

        if (appearsInTopN(snapshot, input.providerId, topN)) {
          currentAppearances += 1;
        }
        if (appearsInTopN(rerankSnapshotWithPlan(snapshot, input.providerId, "pro"), input.providerId, topN)) {
          proAppearances += 1;
        }
        if (
          appearsInTopN(
            rerankSnapshotWithPlan(snapshot, input.providerId, "premium"),
            input.providerId,
            topN,
          )
        ) {
          premiumAppearances += 1;
        }
      } else {
        const ids = (log.provider_ids as string[] | null) ?? [];
        if (ids.includes(input.providerId)) currentAppearances += 1;
      }
    }

    return {
      categorySearches: rows.length,
      currentAppearances,
      proAppearances,
      premiumAppearances,
      snapshotsUsed,
      unavailable: rows.length === 0 || snapshotsUsed === 0,
    };
  } catch (e) {
    console.error("[growth-potential] unexpected:", e);
    return EMPTY;
  }
}

function countLegacyAppearances(
  rows: { provider_ids?: string[] | null }[],
  providerId: string,
): GrowthPotentialResult {
  let currentAppearances = 0;
  for (const log of rows) {
    const ids = log.provider_ids ?? [];
    if (ids.includes(providerId)) currentAppearances += 1;
  }
  return {
    categorySearches: rows.length,
    currentAppearances,
    proAppearances: currentAppearances,
    premiumAppearances: currentAppearances,
    snapshotsUsed: 0,
    unavailable: true,
  };
}
