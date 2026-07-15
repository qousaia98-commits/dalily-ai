import type { PlanSlug } from "@/lib/subscription/types";
import { planTierRank } from "@/lib/subscription/limits";
import type { Database } from "@/types/database.types";
import {
  calculateDalilyScore,
  type DalilyScoreContext,
} from "@/lib/search/ranking/dalily-score";

type ProviderRow = Database["public"]["Tables"]["providers"]["Row"];

export type ScoredProvider = {
  provider: ProviderRow;
  dalilyScore: number;
  planTier: number;
};

export type RankProvidersContext = DalilyScoreContext & {
  planSlugsByProviderId?: Map<string, PlanSlug>;
};

/**
 * Rank strategy:
 * 1. Plan tier — Premium > PRO > Starter
 * 2. Within tier — quality Dalily Score (rating, reviews via trust/rating,
 *    completeness, verification, freshness) — never payment alone.
 */
export function rankProviders(
  rows: ProviderRow[],
  context: RankProvidersContext = {},
): ProviderRow[] {
  const scored: ScoredProvider[] = rows.map((provider) => {
    const planSlug =
      context.planSlugsByProviderId?.get(provider.id) ?? context.planSlug ?? "free";
    return {
      provider,
      planTier: planTierRank(planSlug),
      dalilyScore: calculateDalilyScore(provider, {
        priority: context.priority,
        planSlug,
      }),
    };
  });

  scored.sort((a, b) => {
    if (b.planTier !== a.planTier) return b.planTier - a.planTier;
    if (b.dalilyScore !== a.dalilyScore) return b.dalilyScore - a.dalilyScore;
    if (b.provider.review_count !== a.provider.review_count) {
      return b.provider.review_count - a.provider.review_count;
    }
    if (Number(b.provider.rating_avg) !== Number(a.provider.rating_avg)) {
      return Number(b.provider.rating_avg) - Number(a.provider.rating_avg);
    }
    return new Date(b.provider.updated_at).getTime() - new Date(a.provider.updated_at).getTime();
  });

  return scored.map((item) => item.provider);
}
