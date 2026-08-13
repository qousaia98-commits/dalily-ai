import { clamp01 } from "@/lib/ai/types";
import { urgencyRankingBoost } from "@/lib/ai/urgency/detect";
import type {
  AiMatchExplanationItem,
  AiUrgencyLevel,
  ProviderMatchScoreResult,
} from "@/lib/ai/decision/types";
import type { ProviderBehaviourSignals } from "@/lib/ai/provider/behaviour";

export type MatchScoreCandidate = {
  providerId: string;
  ratingAvg: number;
  reviewCount: number;
  verificationStatus: string;
  cityFit: boolean;
  categoryFit: boolean;
  acceptingRequests: boolean;
  /** km; null = unknown */
  distanceKm?: number | null;
  /** Prefer Arabic/English service language overlap (0–1). */
  languageFit?: number;
  recentActivityScore?: number;
  behaviour?: ProviderBehaviourSignals | null;
  /** Soft boost from AI Reputation Engine (-0.1…0.1) */
  reputationBoost?: number | null;
  /** Public trust level label — never a numeric score */
  trustLevel?: string | null;
};

export type MatchScoreContext = {
  urgency: AiUrgencyLevel;
  categorySlug?: string | null;
};

const W = {
  distance: 0.15,
  availability: 0.1,
  category: 0.11,
  rating: 0.11,
  acceptance: 0.09,
  response: 0.09,
  completion: 0.09,
  experience: 0.07,
  preferred: 0.04,
  language: 0.03,
  verified: 0.07,
  activity: 0.04,
  urgencyAlign: 0.03,
  reputation: 0.08,
} as const;

function distanceScore(km: number | null | undefined): number {
  if (km == null || Number.isNaN(km)) return 0.55;
  if (km <= 2) return 1;
  if (km <= 5) return 0.85;
  if (km <= 10) return 0.65;
  if (km <= 20) return 0.4;
  return 0.2;
}

function ratingScore(avg: number, count: number): number {
  const base = clamp01(avg / 5);
  const volume = clamp01(count / 40);
  return clamp01(base * 0.75 + volume * 0.25);
}

/**
 * Overall Match Score 0–100 with explanation bullets.
 */
export function scoreProviderMatch(
  candidate: MatchScoreCandidate,
  ctx: MatchScoreContext,
): ProviderMatchScoreResult {
  const b = candidate.behaviour;
  const parts: Record<string, number> = {
    distance: distanceScore(candidate.distanceKm),
    availability: candidate.acceptingRequests ? 1 : 0,
    category: candidate.categoryFit ? 1 : 0.2,
    rating: ratingScore(candidate.ratingAvg, candidate.reviewCount),
    acceptance: b?.acceptanceRate != null ? clamp01(b.acceptanceRate) : 0.5,
    response:
      b?.avgResponseHours != null
        ? clamp01(1 - Math.min(b.avgResponseHours, 48) / 48)
        : 0.5,
    completion: b?.completionRate != null ? clamp01(b.completionRate) : 0.5,
    experience: clamp01(candidate.reviewCount / 80),
    preferred: preferredJobBoost(b, ctx.categorySlug),
    language: candidate.languageFit ?? 0.6,
    verified: candidate.verificationStatus === "verified" ? 1 : 0.35,
    activity: candidate.recentActivityScore ?? 0.5,
    urgencyAlign: urgencyRankingBoost(ctx.urgency),
    reputation: reputationPart(candidate.reputationBoost, candidate.trustLevel),
  };

  // City fit soft multiplier on distance component
  if (candidate.cityFit) parts.distance = clamp01(parts.distance + 0.1);

  let total = 0;
  for (const [k, w] of Object.entries(W) as Array<[keyof typeof W, number]>) {
    total += (parts[k] ?? 0) * w;
  }

  // Critical urgency: amplify verified + availability
  if (ctx.urgency === "critical") {
    total = clamp01(total * 0.85 + parts.verified * 0.1 + parts.availability * 0.05);
  }

  const score = Math.round(clamp01(total) * 100);
  const explanations = buildExplanations(candidate, parts, score);

  return {
    providerId: candidate.providerId,
    score,
    breakdown: parts,
    explanations,
  };
}

function preferredJobBoost(
  behaviour: ProviderBehaviourSignals | null | undefined,
  categorySlug: string | null | undefined,
): number {
  if (!behaviour || !categorySlug) return 0.5;
  if (behaviour.preferredJobTypes.includes(categorySlug)) return 1;
  return 0.45;
}

/** Maps soft boost / trust level into 0–1 match component — never uses raw internal score. */
function reputationPart(
  boost: number | null | undefined,
  trustLevel: string | null | undefined,
): number {
  if (boost != null && Number.isFinite(boost)) {
    return clamp01(0.55 + boost * 4);
  }
  switch (trustLevel) {
    case "excellent":
      return 0.95;
    case "very_good":
      return 0.82;
    case "good":
      return 0.7;
    case "developing":
      return 0.5;
    case "needs_attention":
      return 0.25;
    default:
      return 0.55;
  }
}

function buildExplanations(
  c: MatchScoreCandidate,
  parts: Record<string, number>,
  score: number,
): AiMatchExplanationItem[] {
  const items: AiMatchExplanationItem[] = [];

  if (c.distanceKm != null && c.distanceKm <= 5) {
    items.push({
      code: "nearby",
      params: { km: Math.round(c.distanceKm * 10) / 10 },
      labelEn: `${Math.round(c.distanceKm * 10) / 10} km away`,
    });
  } else if (c.cityFit) {
    items.push({ code: "city_fit", labelEn: "Same city" });
  }

  if (c.acceptingRequests) {
    items.push({ code: "available", labelEn: "Available now" });
  }

  if (c.ratingAvg >= 4.5) {
    items.push({
      code: "excellent_rating",
      params: { rating: c.ratingAvg },
      labelEn: `Excellent rating (${c.ratingAvg.toFixed(1)})`,
    });
  }

  if (c.reviewCount >= 50) {
    items.push({
      code: "similar_jobs",
      params: { count: c.reviewCount },
      labelEn: `Completed ${c.reviewCount}+ similar jobs`,
    });
  }

  const hours = c.behaviour?.avgResponseHours;
  if (hours != null && hours <= 1) {
    const minutes = Math.max(1, Math.round(hours * 60));
    items.push({
      code: "fast_response",
      params: { minutes },
      labelEn: `Responds within ${minutes} minutes on average`,
    });
  }

  if (c.verificationStatus === "verified") {
    items.push({ code: "verified", labelEn: "Verified business" });
  }

  if (parts.acceptance >= 0.8) {
    items.push({ code: "high_acceptance", labelEn: "High acceptance rate" });
  }

  if (items.length === 0) {
    items.push({
      code: "match_score",
      params: { score },
      labelEn: `Match score ${score}%`,
    });
  }

  return items.slice(0, 5);
}

export function rankProvidersByMatchScore(
  candidates: MatchScoreCandidate[],
  ctx: MatchScoreContext,
): ProviderMatchScoreResult[] {
  return candidates
    .map((c) => scoreProviderMatch(c, ctx))
    .sort((a, b) => b.score - a.score);
}
