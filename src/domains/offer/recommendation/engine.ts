/**
 * Offer Decision Engine core.
 * Ranking math stays private — only PublicOfferDecision leaves this module.
 */

import type {
  OfferDecisionSignals,
  OfferDecisionWeight,
  OfferHighlightBadge,
  OfferInsightCode,
  OfferRiskCode,
  PublicOfferDecision,
  PublicOfferDecisionBoard,
} from "./types";
import {
  DEFAULT_OFFER_DECISION_WEIGHTS,
  mergeOfferDecisionWeights,
} from "./weights";
import { createAdminClient } from "@/lib/supabase/admin";
import { computePublicTrustScorePct } from "@/lib/providers/public-trust-score";
import type { MarketplaceOfferView } from "@/domains/offer/types";

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

async function loadWeights(): Promise<OfferDecisionWeight[]> {
  try {
    const admin = createAdminClient();
    // Optional table — not yet in generated Database types until types are regenerated.
    const { data, error } = await (
      admin as unknown as {
        from: (relation: string) => {
          select: (cols: string) => PromiseLike<{
            data: Array<Record<string, unknown>> | null;
            error: { message: string } | null;
          }>;
        };
      }
    )
      .from("offer_decision_weights")
      .select("*");
    if (error || !data?.length) return DEFAULT_OFFER_DECISION_WEIGHTS;
    return mergeOfferDecisionWeights(
      DEFAULT_OFFER_DECISION_WEIGHTS,
      data.map((r) => ({
        signalKey: String(r.signal_key),
        category: String(r.category ?? "general"),
        weight: Number(r.weight),
        enabled: Boolean(r.enabled),
        mlReady: Boolean(r.ml_ready),
        description: (r.description as string | null) ?? null,
      })),
    );
  } catch {
    return DEFAULT_OFFER_DECISION_WEIGHTS;
  }
}

function weightMap(weights: OfferDecisionWeight[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const w of weights) {
    if (!w.enabled) continue;
    m.set(w.signalKey, w.weight);
  }
  return m;
}

function normalizeSignals(s: OfferDecisionSignals, cohort: OfferDecisionSignals[]) {
  const prices = cohort.map((c) => c.price);
  const minP = Math.min(...prices);
  const maxP = Math.max(...prices);
  const span = Math.max(1, maxP - minP);

  const response = s.responseHoursAvg;
  const distances = cohort
    .map((c) => c.distanceKm)
    .filter((d): d is number => d != null);
  const maxDist = distances.length ? Math.max(...distances, 1) : 1;

  return {
    completed_jobs: clamp01(Math.log10(Math.max(1, s.completedJobs) + 1) / 2.2),
    rating: clamp01(s.ratingAvg / 5),
    review_quality: clamp01(
      s.reviewCount <= 0
        ? 0.35
        : (s.ratingAvg / 5) * (0.5 + 0.5 * Math.min(1, s.reviewCount / 20)),
    ),
    response_time:
      response == null ? 0.55 : clamp01(1 - Math.min(response, 48) / 48),
    acceptance_rate: s.acceptanceRate == null ? 0.55 : clamp01(s.acceptanceRate),
    cancellation_rate:
      s.cancellationRate == null ? 0.3 : clamp01(s.cancellationRate),
    trust_score: clamp01(s.trustScorePct / 100),
    profile_completeness: clamp01(s.profileCompleteness / 100),
    verification: s.verified ? 1 : s.partiallyVerified ? 0.65 : 0.3,
    recent_activity: clamp01(1 - Math.min(s.offerAgeHours, 72) / 72),
    repeat_customers:
      s.repeatCustomerRate == null ? 0.45 : clamp01(s.repeatCustomerRate),
    category_experience: clamp01(s.categoryMatch),
    distance:
      s.distanceKm == null ? 0.55 : clamp01(1 - s.distanceKm / maxDist),
    availability: s.availableNow ? 1 : 0.4,
    price_value: clamp01(1 - (s.price - minP) / span),
    featured_override: s.featured ? 1 : 0,
  };
}

function scoreSignals(
  normalized: Record<string, number>,
  weights: Map<string, number>,
): number {
  let total = 0;
  let mass = 0;
  for (const [key, value] of Object.entries(normalized)) {
    const w = weights.get(key);
    if (w == null || w === 0) continue;
    total += value * w;
    mass += Math.abs(w);
  }
  if (mass <= 0) return 0.5;
  return clamp01(total / mass);
}

function buildInsights(s: OfferDecisionSignals): OfferInsightCode[] {
  const out: OfferInsightCode[] = [];
  if (s.responseHoursAvg != null && s.responseHoursAvg <= 4) out.push("fast_response");
  if (s.ratingAvg >= 4.5 && s.reviewCount >= 5) out.push("highly_rated");
  if (s.categoryMatch >= 0.8) out.push("category_specialist");
  if (s.completedJobs >= 25) out.push("frequently_hired");
  if (s.completedJobs < 3 && s.reviewCount < 3) out.push("new_provider");
  if (s.acceptanceRate != null && s.acceptanceRate >= 0.85) {
    out.push("excellent_completion");
  }
  if (s.categoryMatch >= 0.6 && s.completedJobs >= 5) out.push("similar_experience");
  if (s.verified) out.push("verified_business");
  if (s.trustScorePct >= 85) out.push("strong_reliability");
  return out.slice(0, 5);
}

function buildRisks(s: OfferDecisionSignals): OfferRiskCode[] {
  const out: OfferRiskCode[] = [];
  if (s.completedJobs < 3 && s.reviewCount < 3) out.push("new_provider");
  if (s.completedJobs < 5) out.push("limited_history");
  if (s.responseHoursAvg != null && s.responseHoursAvg >= 24) out.push("slow_response");
  if (s.cancellationRate != null && s.cancellationRate >= 0.2) {
    out.push("recent_cancellations");
  }
  if (s.profileCompleteness < 55) out.push("incomplete_profile");
  if (!s.availableNow) out.push("temporarily_unavailable");
  return out.slice(0, 4);
}

function buildBadges(s: OfferDecisionSignals): OfferHighlightBadge[] {
  const out: OfferHighlightBadge[] = [];
  if (s.ratingAvg >= 4.6 && s.reviewCount >= 8) out.push("top_rated");
  if (s.responseHoursAvg != null && s.responseHoursAvg <= 3) out.push("fast_responder");
  if (s.trustScorePct >= 88 && s.ratingAvg >= 4.3) out.push("highly_recommended");
  if (s.verified) out.push("verified");
  if (s.trustScorePct >= 80) out.push("reliable");
  if (s.completedJobs >= 40) out.push("experienced");
  if (s.completedJobs >= 15 && s.repeatCustomerRate != null && s.repeatCustomerRate >= 0.35) {
    out.push("popular");
  }
  if (s.repeatCustomerRate != null && s.repeatCustomerRate >= 0.45) {
    out.push("community_favorite");
  }
  return out.slice(0, 4);
}

function assistantReasons(
  s: OfferDecisionSignals,
  insights: OfferInsightCode[],
): string[] {
  const map: Record<OfferInsightCode, string> = {
    fast_response: "fast_communication",
    highly_rated: "excellent_reviews",
    category_specialist: "category_fit",
    frequently_hired: "strong_demand",
    new_provider: "emerging_talent",
    excellent_completion: "strong_completion",
    similar_experience: "relevant_experience",
    verified_business: "verified_business",
    strong_reliability: "strong_reliability",
    good_value: "good_value",
  };
  const reasons = insights.map((i) => map[i]).filter(Boolean);
  if (s.verified && !reasons.includes("verified_business")) {
    reasons.unshift("verified_business");
  }
  return reasons.slice(0, 4);
}

function summaryKey(insights: OfferInsightCode[]): string | null {
  if (insights.includes("highly_rated") && insights.includes("fast_response")) {
    return "satisfaction_and_speed";
  }
  if (insights.includes("strong_reliability") && insights.includes("frequently_hired")) {
    return "reliability_and_jobs";
  }
  if (insights.includes("verified_business") && insights.includes("excellent_completion")) {
    return "verified_and_completion";
  }
  if (insights.includes("fast_response")) return "fast_response";
  if (insights.includes("highly_rated")) return "high_satisfaction";
  if (insights.includes("strong_reliability")) return "strong_reliability";
  return insights[0] ?? null;
}

export type RankedOfferInternal = {
  offer: MarketplaceOfferView;
  signals: OfferDecisionSignals;
  rawScore: number;
  decision: PublicOfferDecision;
};

export function rankOffersWithSignals(input: {
  offers: MarketplaceOfferView[];
  signalsByOfferId: Map<string, OfferDecisionSignals>;
  weights: OfferDecisionWeight[];
}): RankedOfferInternal[] {
  const weights = weightMap(input.weights);
  const cohort = input.offers
    .map((o) => input.signalsByOfferId.get(o.id))
    .filter((s): s is OfferDecisionSignals => Boolean(s));

  const scored = input.offers.map((offer) => {
    const signals = input.signalsByOfferId.get(offer.id);
    if (!signals) {
      return null;
    }
    const normalized = normalizeSignals(signals, cohort);
    const rawScore = scoreSignals(normalized, weights);
    const insights = buildInsights(signals);
    const risks = buildRisks(signals);
    const badges = buildBadges(signals);
    return {
      offer,
      signals,
      rawScore,
      insights,
      risks,
      badges,
      assistantReasons: assistantReasons(signals, insights),
      summaryKey: summaryKey(insights),
    };
  }).filter(Boolean) as Array<{
    offer: MarketplaceOfferView;
    signals: OfferDecisionSignals;
    rawScore: number;
    insights: OfferInsightCode[];
    risks: OfferRiskCode[];
    badges: OfferHighlightBadge[];
    assistantReasons: string[];
    summaryKey: string | null;
  }>;

  scored.sort((a, b) => b.rawScore - a.rawScore);

  const top = scored[0];
  const second = scored[1];
  const highConfidence =
    Boolean(top) &&
    top!.rawScore >= 0.62 &&
    (!second || top!.rawScore - second.rawScore >= 0.06) &&
    top!.risks.filter((r) => r !== "temporarily_unavailable").length <= 1;

  return scored.map((row, index) => {
    const recommendationScore = Math.round(row.rawScore * 100);
    const confidence: PublicOfferDecision["confidence"] =
      row.rawScore >= 0.7 ? "high" : row.rawScore >= 0.5 ? "medium" : "low";
    const decision: PublicOfferDecision = {
      offerId: row.offer.id,
      providerId: row.offer.providerId,
      rank: index + 1,
      recommendationScore,
      confidence,
      isRecommended: highConfidence && index === 0,
      recommendationSummaryKey:
        highConfidence && index === 0 ? row.summaryKey : null,
      insights: row.insights,
      risks: row.risks,
      badges: row.badges,
      assistantReasons: row.assistantReasons,
      compare: {
        ratingAvg: row.offer.ratingAvg,
        trustScorePct: row.signals.trustScorePct,
        completedJobs: row.signals.completedJobs,
        responseHoursAvg: row.signals.responseHoursAvg,
        acceptanceRatePct:
          row.signals.acceptanceRate != null
            ? Math.round(row.signals.acceptanceRate * 100)
            : null,
        verified: row.signals.verified,
        availableNow: row.signals.availableNow,
        portfolioSize: row.signals.portfolioSize,
        reviewCount: row.signals.reviewCount,
        price: row.offer.price,
        currency: row.offer.currency,
      },
    };
    return {
      offer: row.offer,
      signals: row.signals,
      rawScore: row.rawScore,
      decision,
    };
  });
}

export async function buildOfferDecisionBoard(input: {
  requestId: string;
  offers: MarketplaceOfferView[];
  signalsByOfferId: Map<string, OfferDecisionSignals>;
  shortlistedProviderIds?: string[];
}): Promise<PublicOfferDecisionBoard> {
  const weights = await loadWeights();
  const ranked = rankOffersWithSignals({
    offers: input.offers,
    signalsByOfferId: input.signalsByOfferId,
    weights,
  });

  return {
    requestId: input.requestId,
    recommendedOfferId: ranked.find((r) => r.decision.isRecommended)?.offer.id ?? null,
    decisions: ranked.map((r) => r.decision),
    shortlistedProviderIds: input.shortlistedProviderIds ?? [],
    generatedAt: new Date().toISOString(),
  };
}

export { filterAndSortDecisions } from "./engine-filter";

/** Build signals from offer + optional performance row. */
export function signalsFromOfferAndPerf(
  offer: MarketplaceOfferView,
  perf: {
    acceptance_rate?: number | null;
    cancellation_rate?: number | null;
    avg_response_hours?: number | null;
    repeat_customer_rate?: number | null;
    successful_jobs?: number | null;
  } | null,
  extras?: {
    profileCompleteness?: number;
    portfolioSize?: number;
    availableNow?: boolean;
    distanceKm?: number | null;
    updatedAt?: string | null;
    featured?: boolean;
  },
): OfferDecisionSignals {
  const completedJobs =
    offer.completedJobs ??
    (perf?.successful_jobs != null ? Number(perf.successful_jobs) : 0);
  const ratingAvg = offer.ratingAvg ?? 0;
  const reviewCount = offer.reviewCount ?? 0;
  const verified = offer.verificationStatus === "verified";
  const partiallyVerified = offer.verificationStatus === "partially_verified";
  const responseHoursAvg =
    perf?.avg_response_hours != null ? Number(perf.avg_response_hours) : null;
  const acceptanceRate =
    perf?.acceptance_rate != null ? Number(perf.acceptance_rate) : null;
  const cancellationRate =
    perf?.cancellation_rate != null ? Number(perf.cancellation_rate) : null;
  const repeatCustomerRate =
    perf?.repeat_customer_rate != null
      ? Number(perf.repeat_customer_rate)
      : null;
  const profileCompleteness = extras?.profileCompleteness ?? 60;
  const daysSinceActivity = extras?.updatedAt
    ? Math.floor(
        (Date.now() - new Date(extras.updatedAt).getTime()) / 86_400_000,
      )
    : null;

  const trustScorePct = computePublicTrustScorePct({
    verified,
    partiallyVerified,
    completedJobs,
    ratingAvg,
    reviewCount,
    cancellationRate,
    responseRate: acceptanceRate,
    profileCompleteness,
    daysSinceActivity,
  });

  return {
    completedJobs,
    ratingAvg,
    reviewCount,
    responseHoursAvg,
    acceptanceRate,
    cancellationRate,
    trustScorePct,
    profileCompleteness,
    verified,
    partiallyVerified,
    repeatCustomerRate,
    categoryMatch: 0.7,
    distanceKm: extras?.distanceKm ?? null,
    availableNow: extras?.availableNow ?? true,
    portfolioSize: extras?.portfolioSize ?? 0,
    price: offer.price,
    offerAgeHours: Math.max(
      0,
      (Date.now() - new Date(offer.createdAt).getTime()) / 3_600_000,
    ),
    featured: Boolean(extras?.featured),
  };
}
