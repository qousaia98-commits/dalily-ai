import type { PlanSlug } from "@/lib/subscription/types";
import type { Database } from "@/types/database.types";
import type { ProblemPriority } from "@/lib/search/engine/types";
import {
  scoreBusinessQuality,
  RANKING_WEIGHTS,
  type RankingEngineContext,
} from "@/lib/search/ranking/ranking-engine";

type ProviderRow = Database["public"]["Tables"]["providers"]["Row"];

/** @deprecated Use RANKING_WEIGHTS from ranking-engine */
export const DALILY_SCORE_WEIGHTS = RANKING_WEIGHTS;

export type DalilyScoreContext = {
  priority?: ProblemPriority | null;
  planSlug?: PlanSlug;
};

/** Quality-only score (no subscription) — legacy helper. */
export function calculateDalilyScore(
  provider: ProviderRow,
  context: DalilyScoreContext | RankingEngineContext = {},
): number {
  return scoreBusinessQuality(provider, context.priority);
}
