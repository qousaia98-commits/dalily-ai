/** Sprint 8 Phase 1 — AI Smart Matching Engine types */

export const MATCHING_MODEL_VERSION = "smart-match-v1";
export const MATCHING_ML_VERSION = "smart-match-ml-v0";

export type MatchSignalCategory =
  | "geo"
  | "availability"
  | "reputation"
  | "quality"
  | "behaviour"
  | "identity"
  | "preference"
  | "price"
  | "fairness"
  | "risk"
  | "ml"
  | "other";

export type MatchSignalKey =
  | "distance"
  | "travel_time"
  | "availability"
  | "workload"
  | "reputation"
  | "trust_level"
  | "verification"
  | "category_expertise"
  | "experience"
  | "completed_jobs"
  | "repeat_customers"
  | "response_time"
  | "acceptance_rate"
  | "completion_rate"
  | "cancellation_rate"
  | "recommendation_rate"
  | "review_quality"
  | "recent_activity"
  | "business_hours"
  | "languages"
  | "price_competitiveness"
  | "quality_cases"
  | "fraud_risk"
  | "customer_preferences"
  | "preferred_history"
  | "favourite_providers"
  | "fairness_exploration"
  | "ml_ranker";

export type MatchWeight = {
  signalKey: MatchSignalKey | string;
  category: MatchSignalCategory | string;
  weight: number;
  enabled: boolean;
  mlReady: boolean;
  description?: string | null;
};

export type MatchRawSignals = {
  distanceKm: number | null;
  travelTimeMin: number | null;
  acceptingRequests: boolean;
  workloadScore: number;
  vacationMode: boolean;
  pauseMode: boolean;
  withinBusinessHours: boolean;
  jobsToday: number;
  maxDailyJobs: number;
  reputationBoost: number | null;
  trustLevel: string | null;
  verificationStatus: string;
  categoryFit: boolean;
  experienceProxy: number;
  completedJobs: number;
  repeatCustomerRate: number | null;
  avgResponseHours: number | null;
  acceptanceRate: number | null;
  completionRate: number | null;
  cancellationRate: number | null;
  recommendationRate: number | null;
  ratingAvg: number;
  reviewCount: number;
  recentActivityScore: number;
  languageFit: number;
  priceCompetitiveness: number | null;
  openQualityCases: number;
  fraudRisk01: number | null;
  preferenceFit: number;
  preferredHistory: boolean;
  isFavourite: boolean;
  reviewCountForFairness: number;
  /** Optional ML model score 0..1 */
  mlRankScore?: number | null;
};

export type MatchSignalResult = {
  signalKey: string;
  category: string;
  rawValue: number;
  normalizedValue: number;
  weight: number;
  contribution: number;
  source: "rule" | "heuristic" | "ml";
};

export type PublicMatchExplanation = {
  code: string;
  labelEn: string;
  labelAr?: string;
  params?: Record<string, string | number>;
};

export type MatchComputation = {
  providerId: string;
  internalScore: number;
  fairnessBoost: number;
  mlContribution: number;
  signals: MatchSignalResult[];
  explanations: PublicMatchExplanation[];
  algorithmVersion: string;
  experimentId: string | null;
  latencyMs: number;
};

export type CustomerPreferences = {
  customerId: string;
  preferredLanguage: string | null;
  preferredGender: string | null;
  budgetMin: number | null;
  budgetMax: number | null;
  preferredResponseSpeed: "fast" | "normal" | "flexible" | null;
  favouriteProviderIds: string[];
  preferredHours: Record<string, unknown>;
  favouriteCategories: string[];
  frequentLocations: unknown[];
  learnedProfile: Record<string, unknown>;
};

export type ProviderCapacity = {
  providerId: string;
  maxDailyJobs: number;
  jobsToday: number;
  vacationMode: boolean;
  pauseMode: boolean;
  acceptingRequests: boolean;
  businessHours: Record<string, unknown>;
  nextAvailableAt: string | null;
  workloadScore: number;
};

export type FairnessParams = {
  explorationBoostMax: number;
  coldStartBoostMax: number;
  coldStartReviewThreshold: number;
  rotationAmplitude: number;
  boostDecayHours: number;
};

export const DEFAULT_FAIRNESS_PARAMS: FairnessParams = {
  explorationBoostMax: 0.08,
  coldStartBoostMax: 0.12,
  coldStartReviewThreshold: 8,
  rotationAmplitude: 0.04,
  boostDecayHours: 72,
};

/** Public recommendation card — never includes internal scores */
export type PublicMatchRecommendation = {
  providerId: string;
  rank: number;
  explanations: PublicMatchExplanation[];
  trustLevel: string | null;
  verificationStatus: string;
  ratingAvg: number;
  reviewCount: number;
};
