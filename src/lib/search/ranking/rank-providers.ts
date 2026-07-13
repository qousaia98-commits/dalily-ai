import type { Database } from "@/types/database.types";
import {
  calculateDalilyScore,
  type DalilyScoreContext,
} from "@/lib/search/ranking/dalily-score";

type ProviderRow = Database["public"]["Tables"]["providers"]["Row"];

export type ScoredProvider = {
  provider: ProviderRow;
  dalilyScore: number;
};

/**
 * Ranks providers by weighted Dalily Score (descending).
 */
export function rankProviders(
  rows: ProviderRow[],
  context: DalilyScoreContext = {},
): ProviderRow[] {
  const scored: ScoredProvider[] = rows.map((provider) => ({
    provider,
    dalilyScore: calculateDalilyScore(provider, context),
  }));

  scored.sort((a, b) => {
    if (b.dalilyScore !== a.dalilyScore) return b.dalilyScore - a.dalilyScore;
    return new Date(b.provider.created_at).getTime() - new Date(a.provider.created_at).getTime();
  });

  return scored.map((item) => item.provider);
}
