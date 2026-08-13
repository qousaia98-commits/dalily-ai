import type { TrustLevel } from "@/lib/reputation/types";

/**
 * Map internal 0–100 score → public trust level.
 * `needs_attention` is admin-facing only (low score or forced).
 */
export function mapScoreToTrustLevel(
  score: number,
  opts?: { reviewCount?: number; forceNeedsAttention?: boolean },
): TrustLevel {
  if (opts?.forceNeedsAttention) return "needs_attention";
  const s = Math.max(0, Math.min(100, score));
  const reviews = opts?.reviewCount ?? 0;

  if (reviews < 3 && s < 55) return "new_provider";
  if (s >= 88) return "excellent";
  if (s >= 75) return "very_good";
  if (s >= 60) return "good";
  if (s >= 42) return "developing";
  if (s < 35) return "needs_attention";
  return "new_provider";
}

/** Customers never see needs_attention — map down to developing. */
export function publicTrustLevel(level: TrustLevel): Exclude<TrustLevel, "needs_attention"> {
  if (level === "needs_attention") return "developing";
  return level;
}

export function trustLevelRank(level: TrustLevel): number {
  const order: TrustLevel[] = [
    "needs_attention",
    "new_provider",
    "developing",
    "good",
    "very_good",
    "excellent",
  ];
  return order.indexOf(level);
}

/** Soft search/recommendation boost from trust level (not score alone). */
export function trustLevelBoost(level: TrustLevel): {
  searchBoost: number;
  recommendationBoost: number;
} {
  switch (level) {
    case "excellent":
      return { searchBoost: 0.08, recommendationBoost: 0.1 };
    case "very_good":
      return { searchBoost: 0.05, recommendationBoost: 0.07 };
    case "good":
      return { searchBoost: 0.03, recommendationBoost: 0.04 };
    case "developing":
      return { searchBoost: 0.01, recommendationBoost: 0.01 };
    case "new_provider":
      return { searchBoost: 0, recommendationBoost: 0 };
    case "needs_attention":
      return { searchBoost: -0.06, recommendationBoost: -0.08 };
  }
}
