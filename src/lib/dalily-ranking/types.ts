/** Sprint 40 — Ranking domain types + AI extension stubs */

import type { DalilyScoreComponentKey, DalilyWeightMap } from "@/lib/dalily-ranking/weights";

export type DalilyComponentScores = Record<DalilyScoreComponentKey, number>;

export type DalilyScoreBreakdown = {
  providerId: string;
  /** 0–100 overall */
  overall: number;
  /** Normalized 0–1 components */
  components: DalilyComponentScores;
  /** Weighted contribution 0–1 before *100 */
  weighted: DalilyComponentScores;
  weights: DalilyWeightMap;
  /** Smart Match score used in blend (0–1), if any */
  smartMatchScore: number | null;
  /** Final search ranking score after blend (0–1) */
  finalScore: number;
  computedAt: string;
};

export type RecommendationBadgeId =
  | "highly_rated"
  | "fast_response"
  | "available_today"
  | "very_close"
  | "verified"
  | "top_category"
  | "excellent_completion"
  | "newest_trusted";

export type RecommendationBadge = {
  id: RecommendationBadgeId;
  priority: number;
};

export type RankingExplanation = {
  providerId: string;
  overall: number;
  position: number | null;
  topStrengths: DalilyScoreComponentKey[];
  topWeaknesses: DalilyScoreComponentKey[];
  badges: RecommendationBadge[];
  summaryKeys: string[];
};

export type DalilyRankingAiExtension =
  | "personalized_recommendations"
  | "behavior_based_ranking"
  | "seasonal_ranking"
  | "demand_prediction"
  | "fraud_detection";

export type ScoreCalculatorInput = {
  providerId: string;
  ratingAvg: number;
  reviewCount: number;
  trustScore: number;
  verificationStatus: string;
  profileCompleteness: number;
  responseTimeHours: number | null;
  completedJobs: number;
  distanceKm: number | null;
  radiusKm?: number | null;
  /** From Smart Match availability factor when known */
  availabilityHint?: number | null;
  /** Learning performance (optional) */
  acceptanceRate?: number | null;
  completionRate?: number | null;
  cancellationRate?: number | null;
  /** Activity proxies */
  updatedAt?: string | null;
  createdAt?: string | null;
  /** Popularity proxies (dashboard may pass richer values) */
  profileViews?: number | null;
  searchAppearances?: number | null;
  bookingConversionRate?: number | null;
  repeatCustomers?: number | null;
  /** Unread / response consistency proxies */
  unreadRatio?: number | null;
  planIsPremium?: boolean;
  matchesCategory?: boolean;
};
