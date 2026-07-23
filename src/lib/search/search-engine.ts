import { categoryForProblem } from "@/lib/search/engine/problem-catalog";
import type { SearchEngineInput, SearchEngineResult } from "@/lib/search/engine/types";
import { SEARCH_TOP_N as TOP_N } from "@/lib/search/engine/types";
import { getCategoryNameMap, getCategorySlugMap } from "@/lib/categories/queries";
import { mapProviderRowsToListItems } from "@/lib/search/mapper/provider-list-mapper";
import {
  type ProblemDetector,
  hybridProblemDetector,
} from "@/lib/search/problem-detection";
import { rankProvidersDetailed } from "@/lib/search/ranking/rank-providers";
import { fetchImagePaths } from "@/lib/search/repository/provider-search.repository";
import {
  insertImpressionBatch,
  insertSearchLog,
} from "@/lib/search/repository/search-log.repository";
import {
  type SearchProvider,
  relationalSearchProvider,
} from "@/lib/search/search-provider";
import { getAuthUser } from "@/lib/auth/session";
import { getActivePlanSlugsByProviderIds } from "@/lib/subscription/repository";
import { haversineKm } from "@/lib/geo/distance";
import { CITY_CENTROIDS } from "@/lib/geo/city-centroids";
import { citySlugFromId } from "@/lib/providers/reference";
import {
  analyzeServiceRequest,
  fetchCompletedJobsByProviderIds,
  resolveDynamicRadiusKm,
} from "@/lib/search/smart-match";
import {
  fetchCustomerPreferenceProfile,
  fetchPerformanceScoresByProviderIds,
  logLearningEvent,
} from "@/lib/search/learning";
import type { Database } from "@/types/database.types";
import type { MatchConfidence } from "@/lib/search/learning/types";

type ProviderRow = Database["public"]["Tables"]["providers"]["Row"];

function resolveProviderCoords(row: ProviderRow): { lat: number; lng: number } | null {
  if (
    typeof row.latitude === "number" &&
    typeof row.longitude === "number" &&
    Number.isFinite(row.latitude) &&
    Number.isFinite(row.longitude)
  ) {
    return { lat: row.latitude, lng: row.longitude };
  }
  const cityKey = citySlugFromId(row.city_id);
  if (cityKey && CITY_CENTROIDS[cityKey]) return CITY_CENTROIDS[cityKey];
  return null;
}

function buildDistanceMap(
  rows: ProviderRow[],
  userLat: number | null | undefined,
  userLng: number | null | undefined,
): Map<string, number | null> {
  const map = new Map<string, number | null>();
  if (
    userLat == null ||
    userLng == null ||
    !Number.isFinite(userLat) ||
    !Number.isFinite(userLng)
  ) {
    for (const row of rows) map.set(row.id, null);
    return map;
  }

  for (const row of rows) {
    const coords = resolveProviderCoords(row);
    if (!coords) {
      map.set(row.id, null);
      continue;
    }
    map.set(row.id, haversineKm(userLat, userLng, coords.lat, coords.lng));
  }
  return map;
}

/**
 * Dalily Search Engine — Smart Local Matching via ranking-engine.
 */
export class DalilySearchEngine {
  constructor(
    private readonly problemDetector: ProblemDetector = hybridProblemDetector,
    private readonly searchProvider: SearchProvider = relationalSearchProvider,
  ) {}

  async search(input: SearchEngineInput): Promise<SearchEngineResult> {
    const parsed = input.query ? await this.problemDetector.detect(input.query) : null;

    const problemId = parsed?.problem?.problemId ?? null;
    const priority = parsed?.problem?.priority ?? null;
    const citySlug = input.citySlug ?? parsed?.citySlug ?? null;
    const categorySlug =
      input.categorySlug ??
      (problemId && !input.groupSlug ? categoryForProblem(problemId) : undefined);
    const groupSlug = input.groupSlug;
    const textTerms = parsed?.textTerms ?? "";
    const sort = input.sort ?? "relevant";
    const hasUserLocation =
      input.userLat != null &&
      input.userLng != null &&
      Number.isFinite(input.userLat) &&
      Number.isFinite(input.userLng);

    const dynamicRadius = resolveDynamicRadiusKm({
      problemId,
      categorySlug: categorySlug ?? groupSlug ?? null,
      priority,
    });

    const useDynamic = input.useDynamicRadius !== false;
    let nearbyRadius = input.nearbyRadius ?? null;
    let radiusIsDynamic = false;

    // Auto-apply adaptive radius when location is known and caller didn't set a radius
    if (hasUserLocation && useDynamic && nearbyRadius == null) {
      nearbyRadius = dynamicRadius;
      radiusIsDynamic = true;
    }

    if (nearbyRadius == null) {
      nearbyRadius = hasUserLocation ? 10 : "city";
    }

    const { providers: rows } = await this.searchProvider.search({
      categorySlug: groupSlug ? undefined : categorySlug,
      groupSlug,
      citySlug: citySlug ?? undefined,
      textTerms: textTerms || undefined,
      problemId,
      priority,
      verifiedOnly: input.verifiedOnly,
      limit: 50,
    });

    const distanceByProviderId = buildDistanceMap(rows, input.userLat, input.userLng);

    let filtered = rows;
    if (hasUserLocation && nearbyRadius && nearbyRadius !== "city") {
      filtered = rows.filter((row) => {
        const d = distanceByProviderId.get(row.id);
        return d != null && d <= nearbyRadius;
      });
      // Soft fallback: widen once if empty
      if (filtered.length === 0 && typeof nearbyRadius === "number") {
        const widened = Math.min(50, Math.round(nearbyRadius * 1.5));
        filtered = rows.filter((row) => {
          const d = distanceByProviderId.get(row.id);
          return d != null && d <= widened;
        });
      }
      if (filtered.length === 0) filtered = rows;
    }

    const providerIds = filtered.map((row) => row.id);
    const [
      planSlugsByProviderId,
      completedJobsByProviderId,
      categorySlugById,
      performanceByProviderId,
      customerPreferences,
    ] = await Promise.all([
      getActivePlanSlugsByProviderIds(providerIds),
      fetchCompletedJobsByProviderIds(providerIds),
      getCategorySlugMap(),
      fetchPerformanceScoresByProviderIds(providerIds),
      fetchCustomerPreferenceProfile(input.userId),
    ]);

    const categorySlugByProviderId = new Map<string, string>();
    for (const row of filtered) {
      const slug = categorySlugById.get(row.category_id);
      if (slug) categorySlugByProviderId.set(row.id, slug);
    }

    const numericRadius =
      nearbyRadius && nearbyRadius !== "city" ? nearbyRadius : null;

    const {
      providers: rankedAll,
      snapshot,
      candidates,
      confidenceByProviderId,
    } = rankProvidersDetailed(filtered, {
      priority,
      planSlugsByProviderId,
      distanceByProviderId,
      completedJobsByProviderId,
      targetCategorySlug: categorySlug ?? null,
      categorySlugByProviderId,
      radiusKm: numericRadius,
      sort,
      performanceByProviderId,
      customerPreferences,
      applyLearning: true,
    });

    const ranked = rankedAll.slice(0, TOP_N);
    const rankedCandidates = candidates.slice(0, TOP_N);
    const displayIds = ranked.map((r) => r.id);

    const imageIds = ranked
      .flatMap((row) => [row.avatar_image_id, row.cover_image_id])
      .filter((id): id is string => Boolean(id));

    const [imagePathById, categoryNameBySlug] = await Promise.all([
      fetchImagePaths(imageIds),
      getCategoryNameMap(),
    ]);

    const completedJobsMap = new Map(
      rankedCandidates.map((c) => [c.provider.id, c.completedJobs] as const),
    );

    const confidenceMap = new Map<string, MatchConfidence | null>();
    for (const id of displayIds) {
      confidenceMap.set(id, confidenceByProviderId?.get(id) ?? null);
    }

    const providers = mapProviderRowsToListItems(
      ranked,
      imagePathById,
      categorySlugById,
      categoryNameBySlug,
      planSlugsByProviderId,
      distanceByProviderId,
      completedJobsMap,
      input.locale === "ar" ? "ar" : "en",
      confidenceMap,
    );

    const advisor = analyzeServiceRequest({
      problemId,
      priority,
      categorySlug: categorySlug ?? null,
    });

    const result: SearchEngineResult = {
      providers,
      parsed: {
        problemId,
        priority,
        categorySlug: categorySlug ?? null,
        groupSlug: groupSlug ?? null,
        citySlug,
        textTerms,
      },
      nearby: {
        active: Boolean(hasUserLocation && nearbyRadius && nearbyRadius !== "city"),
        radiusKm: nearbyRadius,
        hasUserLocation,
        dynamic: radiusIsDynamic,
      },
      advisor: problemId ? advisor : null,
    };

    void this.logSearch(input, parsed?.normalized ?? null, result, snapshot, displayIds);

    // Learning: recommendation_shown (append-only, non-blocking)
    for (const [index, id] of displayIds.entries()) {
      void logLearningEvent({
        eventType: "recommendation_shown",
        providerId: id,
        customerId: input.userId ?? null,
        metadata: { position: index + 1, problemId, categorySlug: categorySlug ?? null },
      });
    }

    return result;
  }

  private async logSearch(
    input: SearchEngineInput,
    normalizedQuery: string | null,
    result: SearchEngineResult,
    snapshot: import("@/lib/search/ranking/ranking-engine").RankingSnapshotEntry[],
    displayIds: string[],
  ): Promise<void> {
    const hasSignal =
      Boolean(input.query?.trim()) ||
      Boolean(result.parsed.categorySlug) ||
      Boolean(result.parsed.groupSlug) ||
      Boolean(result.parsed.citySlug);
    if (!hasSignal) return;

    try {
      const userId = input.userId ?? (await getAuthUser())?.id ?? null;
      const nearby =
        input.nearbyRadius == null && result.nearby?.radiusKm == null
          ? null
          : (result.nearby?.radiusKm ?? input.nearbyRadius) === "city"
            ? "city"
            : String(result.nearby?.radiusKm ?? input.nearbyRadius);

      const logId = await insertSearchLog({
        queryText: input.query?.trim() || "[filter]",
        normalizedQuery,
        problemId: result.parsed.problemId,
        categorySlug: result.parsed.categorySlug,
        citySlug: result.parsed.citySlug,
        priority: result.parsed.priority,
        resultCount: result.providers.length,
        providerIds: displayIds,
        nearbyRadius: nearby,
        rankingSnapshot: snapshot,
        userId,
        locale: input.locale ?? null,
        inputMode: input.inputMode ?? "text",
        voiceLanguage: input.inputMode === "voice" ? (input.voiceLanguage ?? null) : null,
      });

      await insertImpressionBatch(displayIds, logId);
    } catch (error) {
      console.error("[search_logs] unexpected failure:", error);
    }
  }
}

export const dalilySearchEngine = new DalilySearchEngine();

export async function runDalilySearch(input: SearchEngineInput): Promise<SearchEngineResult> {
  return dalilySearchEngine.search(input);
}
