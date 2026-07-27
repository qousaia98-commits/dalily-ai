/** Sprint 7 Phase 3 — AI Reputation Engine types. */

export type ReputationCategory =
  | "verification"
  | "reviews"
  | "booking"
  | "communication"
  | "reliability"
  | "activity";

/** Public trust levels — never expose numeric scores to customers. */
export type TrustLevel =
  | "excellent"
  | "very_good"
  | "good"
  | "developing"
  | "new_provider"
  | "needs_attention";

export type ReputationTrend = "rising" | "stable" | "declining";

export type SignalSource = "heuristic" | "ml" | "manual" | "import";

export type ReputationSignalKey = string;

export type SignalWeight = {
  signalKey: ReputationSignalKey;
  category: ReputationCategory;
  weight: number;
  enabled: boolean;
  mlReady: boolean;
  description?: string | null;
};

/** Normalized 0–1 value for a single signal. ML can replace computeNormalized. */
export type SignalResult = {
  signalKey: ReputationSignalKey;
  category: ReputationCategory;
  rawValue: number | null;
  normalizedValue: number;
  weight: number;
  contribution: number;
  source: SignalSource;
  metadata?: Record<string, unknown>;
};

export type SignalCollectorContext = {
  providerId: string;
  raw: ProviderReputationRaw;
};

export type SignalCollector = {
  signalKey: ReputationSignalKey;
  category: ReputationCategory;
  /** Pure normalize 0–1 from raw context. Swappable by ML adapters. */
  computeNormalized: (ctx: SignalCollectorContext) => {
    rawValue: number | null;
    normalizedValue: number;
    metadata?: Record<string, unknown>;
  };
};

export type ProviderReputationRaw = {
  verificationStatus: string;
  identityVerified: boolean;
  addressVerified: boolean;
  businessVerified: boolean;
  professionalVerified: boolean;
  documentFreshnessDays: number | null;
  ratingAvg: number;
  reviewCount: number;
  verifiedReviewCount: number;
  recommendationRate: number | null;
  recentRatingAvg: number | null;
  providerResponseRate: number | null;
  reviewQuality: number | null;
  completedJobs: number;
  cancelledJobs: number;
  cancellationRate: number | null;
  acceptanceRate: number | null;
  completionRate: number | null;
  repeatCustomerRate: number | null;
  avgBookingValue: number | null;
  avgResponseHours: number | null;
  unreadRequests: number;
  lateReplyRate: number | null;
  onTimeRate: number | null;
  customerConfirmationRate: number | null;
  complaintRate: number | null;
  refundRate: number | null;
  disputeCount: number;
  policyViolationCount: number;
  profileCompleteness: number;
  updatedAt: string | null;
  createdAt: string | null;
  loginFrequencyScore: number | null;
  marketplaceEngagement: number | null;
  accountAgeDays: number;
};

export type ReputationComputation = {
  providerId: string;
  internalScore: number;
  trustLevel: TrustLevel;
  trend: ReputationTrend;
  searchBoost: number;
  recommendationBoost: number;
  signals: SignalResult[];
  breakdownByCategory: Record<ReputationCategory, number>;
  modelVersion: string;
  computedAt: string;
};

export type ReputationExplanation = {
  audience: "public" | "provider" | "admin";
  locale: "en" | "ar";
  explanationKey: string;
  body: string;
  polarity: "positive" | "neutral" | "improvement";
  signalKey?: string;
  sortOrder: number;
};

export type PublicTrustView = {
  providerId: string;
  trustLevel: TrustLevel;
  trend: ReputationTrend;
  explanations: Array<{ key: string; body: string }>;
  verificationBadges: string[];
};

export type ProviderReputationInsights = {
  providerId: string;
  trustLevel: TrustLevel;
  trend: ReputationTrend;
  /** Internal — never send to public UI */
  internalScore: number;
  strengths: string[];
  improvements: string[];
  suggestions: string[];
  metrics: {
    completedJobs: number;
    cancellationRate: number | null;
    responseTimeHours: number | null;
    recommendationRate: number | null;
  };
  monthlyTrend: Array<{
    period: string;
    trustLevel: TrustLevel;
    score: number;
    at: string;
  }>;
};

export const REPUTATION_MODEL_VERSION = "reputation-engine-v1";
