/**
 * Admin ranking inspection — read-only score breakdowns.
 */

import { createClient } from "@/lib/supabase/server";
import { calculateDalilyScore } from "@/lib/dalily-ranking/score-calculator";
import { buildRecommendationBadges } from "@/lib/dalily-ranking/recommendation-engine";
import { explainDalilyScore } from "@/lib/dalily-ranking/explanation";
import { DEFAULT_DALILY_WEIGHTS } from "@/lib/dalily-ranking/weights";
import type { DalilyScoreBreakdown, RankingExplanation } from "@/lib/dalily-ranking/types";
import { getLocalizedField } from "@/types/provider.types";

export type RankingInspectionRow = {
  providerId: string;
  name: string;
  breakdown: DalilyScoreBreakdown;
  explanation: RankingExplanation;
  weights: typeof DEFAULT_DALILY_WEIGHTS;
};

export async function getAdminRankingInspection(
  locale: string,
  limit = 40,
): Promise<RankingInspectionRow[]> {
  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("providers")
    .select(
      "id, name, rating_avg, review_count, trust_score, verification_status, profile_completeness, response_time_hours, created_at, updated_at, status",
    )
    .eq("status", "active")
    .is("deleted_at", null)
    .order("trust_score", { ascending: false })
    .limit(limit);

  const list = rows ?? [];
  const result: RankingInspectionRow[] = [];

  for (const row of list) {
    const calcInput = {
      providerId: row.id,
      ratingAvg: Number(row.rating_avg) || 0,
      reviewCount: row.review_count ?? 0,
      trustScore: row.trust_score ?? 0,
      verificationStatus: row.verification_status,
      profileCompleteness: row.profile_completeness ?? 0,
      responseTimeHours: row.response_time_hours,
      completedJobs: 0,
      distanceKm: null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      matchesCategory: true,
    };
    const breakdown = calculateDalilyScore(calcInput, { blendWithSmartMatch: false });
    const badges = buildRecommendationBadges({
      breakdown,
      calculatorInput: calcInput,
    });
    const explanation = explainDalilyScore({ breakdown, badges });
    result.push({
      providerId: row.id,
      name: getLocalizedField(row.name as { ar: string; en: string }, locale) || row.id,
      breakdown,
      explanation,
      weights: DEFAULT_DALILY_WEIGHTS,
    });
  }

  return result.sort((a, b) => b.breakdown.overall - a.breakdown.overall);
}
