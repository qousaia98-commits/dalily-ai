import type {
  DalilyScoreBreakdown,
  RecommendationBadge,
  ScoreCalculatorInput,
} from "@/lib/dalily-ranking/types";

/**
 * Rule-based recommendation badges (1–3). AI-ready — swap later.
 */
export function buildRecommendationBadges(input: {
  breakdown: DalilyScoreBreakdown;
  calculatorInput: ScoreCalculatorInput;
  max?: number;
}): RecommendationBadge[] {
  const badges: RecommendationBadge[] = [];
  const c = input.breakdown.components;
  const src = input.calculatorInput;
  const max = input.max ?? 3;

  if (src.verificationStatus === "verified") {
    badges.push({ id: "verified", priority: 95 });
  }
  if (src.ratingAvg >= 4.5 && src.reviewCount >= 3) {
    badges.push({ id: "highly_rated", priority: 90 });
  }
  if (src.responseTimeHours != null && src.responseTimeHours <= 0.5) {
    badges.push({ id: "fast_response", priority: 88 });
  } else if (src.responseTimeHours != null && src.responseTimeHours <= 2) {
    badges.push({ id: "fast_response", priority: 70 });
  }
  if (src.distanceKm != null && src.distanceKm <= 3) {
    badges.push({ id: "very_close", priority: 85 });
  }
  if (c.availability >= 0.75) {
    badges.push({ id: "available_today", priority: 80 });
  }
  if (src.matchesCategory && c.experience >= 0.7) {
    badges.push({ id: "top_category", priority: 75 });
  }
  if (src.completionRate != null && src.completionRate >= 0.85) {
    badges.push({ id: "excellent_completion", priority: 78 });
  }
  if (
    src.createdAt &&
    Date.now() - new Date(src.createdAt).getTime() < 90 * 86_400_000 &&
    src.verificationStatus === "verified"
  ) {
    badges.push({ id: "newest_trusted", priority: 60 });
  }

  return badges
    .sort((a, b) => b.priority - a.priority)
    .filter((b, i, arr) => arr.findIndex((x) => x.id === b.id) === i)
    .slice(0, max);
}
