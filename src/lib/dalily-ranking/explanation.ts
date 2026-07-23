import { DALILY_SCORE_COMPONENT_KEYS } from "@/lib/dalily-ranking/weights";
import type {
  DalilyScoreBreakdown,
  RankingExplanation,
  RecommendationBadge,
} from "@/lib/dalily-ranking/types";

/**
 * Explainable ranking — strengths / weaknesses from component scores.
 */
export function explainDalilyScore(input: {
  breakdown: DalilyScoreBreakdown;
  badges: RecommendationBadge[];
  position?: number | null;
}): RankingExplanation {
  const ranked = [...DALILY_SCORE_COMPONENT_KEYS].sort(
    (a, b) => input.breakdown.components[b] - input.breakdown.components[a],
  );
  const topStrengths = ranked.slice(0, 3);
  const topWeaknesses = [...ranked].reverse().slice(0, 3);

  const summaryKeys: string[] = [];
  if (input.breakdown.overall >= 80) summaryKeys.push("excellent_overall");
  else if (input.breakdown.overall >= 60) summaryKeys.push("solid_overall");
  else summaryKeys.push("needs_improvement");

  for (const s of topStrengths.slice(0, 2)) {
    summaryKeys.push(`strength_${s}`);
  }

  return {
    providerId: input.breakdown.providerId,
    overall: input.breakdown.overall,
    position: input.position ?? null,
    topStrengths,
    topWeaknesses,
    badges: input.badges,
    summaryKeys,
  };
}

export function improvementTipsFromBreakdown(
  breakdown: DalilyScoreBreakdown,
  limit = 4,
): Array<{ component: string; tipKey: string }> {
  const weak = [...DALILY_SCORE_COMPONENT_KEYS]
    .sort((a, b) => breakdown.components[a] - breakdown.components[b])
    .slice(0, limit);

  return weak.map((component) => ({
    component,
    tipKey: `improve_${component}`,
  }));
}
