/**
 * Offer Decision Engine — public types only.
 * Internal weights / raw signal math stay in engine.ts and are never exported to clients.
 */

export const OFFER_DECISION_SORTS = [
  "recommended",
  "rating",
  "trust",
  "completed_jobs",
  "response_time",
  "price",
  "newest",
  "alphabetical",
] as const;
export type OfferDecisionSort = (typeof OFFER_DECISION_SORTS)[number];

export const OFFER_DECISION_FILTERS = [
  "verified_only",
  "available_now",
  "shortlisted",
] as const;
export type OfferDecisionFilter = (typeof OFFER_DECISION_FILTERS)[number];

export type OfferInsightCode =
  | "fast_response"
  | "highly_rated"
  | "category_specialist"
  | "frequently_hired"
  | "new_provider"
  | "excellent_completion"
  | "similar_experience"
  | "verified_business"
  | "strong_reliability"
  | "good_value";

export type OfferRiskCode =
  | "new_provider"
  | "limited_history"
  | "slow_response"
  | "recent_cancellations"
  | "incomplete_profile"
  | "temporarily_unavailable";

export type OfferHighlightBadge =
  | "top_rated"
  | "fast_responder"
  | "highly_recommended"
  | "verified"
  | "reliable"
  | "experienced"
  | "popular"
  | "community_favorite";

export type OfferDecisionWeight = {
  signalKey: string;
  category: string;
  weight: number;
  enabled: boolean;
  mlReady: boolean;
  description?: string | null;
};

/** Enriched signals used for ranking — never sent to clients. */
export type OfferDecisionSignals = {
  completedJobs: number;
  ratingAvg: number;
  reviewCount: number;
  responseHoursAvg: number | null;
  acceptanceRate: number | null;
  cancellationRate: number | null;
  trustScorePct: number;
  profileCompleteness: number;
  verified: boolean;
  partiallyVerified: boolean;
  repeatCustomerRate: number | null;
  categoryMatch: number;
  distanceKm: number | null;
  availableNow: boolean;
  portfolioSize: number;
  price: number;
  offerAgeHours: number;
  /** Admin featured override — boosts ranking without exposing weights. */
  featured: boolean;
};

/** Public recommendation payload for one offer — safe for UI/API. */
export type PublicOfferDecision = {
  offerId: string;
  providerId: string;
  rank: number;
  /** 0–100 public recommendation strength (not formula). */
  recommendationScore: number;
  confidence: "high" | "medium" | "low";
  isRecommended: boolean;
  recommendationSummaryKey: string | null;
  insights: OfferInsightCode[];
  risks: OfferRiskCode[];
  badges: OfferHighlightBadge[];
  assistantReasons: string[];
  compare: {
    ratingAvg: number | null;
    trustScorePct: number;
    completedJobs: number;
    responseHoursAvg: number | null;
    acceptanceRatePct: number | null;
    verified: boolean;
    availableNow: boolean;
    portfolioSize: number;
    reviewCount: number;
    price: number;
    currency: string;
  };
};

export type PublicOfferDecisionBoard = {
  requestId: string;
  recommendedOfferId: string | null;
  decisions: PublicOfferDecision[];
  shortlistedProviderIds: string[];
  generatedAt: string;
};
