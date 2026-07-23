import type { RankedCandidate } from "@/lib/search/ranking/ranking-engine";
import type { SearchSort } from "@/lib/geo/distance";
import { applyLearningToSmartMatch } from "./engine";
import type {
  CustomerPreferenceProfile,
  MatchConfidence,
  ProviderPerformanceRow,
} from "./types";

export type LearningLayerResult = {
  candidates: RankedCandidate[];
  confidenceByProviderId: Map<string, MatchConfidence | null>;
  learningAdjustmentByProviderId: Map<string, number>;
};

/**
 * Apply Learning Layer on top of Smart Match candidates.
 * Does not modify Smart Match factor scoring — only finalScore + order.
 */
export function applyLearningLayer(
  candidates: RankedCandidate[],
  input: {
    performanceByProviderId: Map<string, ProviderPerformanceRow>;
    preferences?: CustomerPreferenceProfile | null;
    sort?: SearchSort;
  },
): LearningLayerResult {
  const confidenceByProviderId = new Map<string, MatchConfidence | null>();
  const learningAdjustmentByProviderId = new Map<string, number>();
  const sort = input.sort ?? "relevant";

  const adjusted = candidates.map((c) => {
    const perf = input.performanceByProviderId.get(c.provider.id);
    const result = applyLearningToSmartMatch({
      smartMatchScore: c.combinedScore,
      performance: perf,
      preferences: input.preferences,
      distanceKm: c.distanceKm,
      planSlug: c.planSlug,
      rating: Number(c.provider.rating_avg),
      responseTimeHours: c.provider.response_time_hours,
    });

    confidenceByProviderId.set(c.provider.id, result.confidence);
    learningAdjustmentByProviderId.set(
      c.provider.id,
      result.learningAdjustment + result.preferenceAdjustment,
    );

    return {
      ...c,
      combinedScore: result.finalScore,
    };
  });

  // Only re-order for relevance — explicit sorts stay user-driven.
  if (sort === "relevant") {
    adjusted.sort((a, b) => {
      if (b.combinedScore !== a.combinedScore) {
        return b.combinedScore - a.combinedScore;
      }
      return a.position - b.position;
    });
  }

  const repositioned = adjusted.map((c, index) => ({
    ...c,
    position: index + 1,
  }));

  return {
    candidates: repositioned,
    confidenceByProviderId,
    learningAdjustmentByProviderId,
  };
}
