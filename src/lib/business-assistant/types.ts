/** Sprint 8 Phase 5 — AI Business Assistant types */

export const BUSINESS_MODEL_VERSION = "business-v1";
export const BUSINESS_ML_VERSION = "business-ml-v0";

export type BusinessTrend = "rising" | "stable" | "declining";

export type BusinessCohort =
  | "top_20"
  | "above_average"
  | "average"
  | "improving"
  | "below_average";

export type BusinessGoalType =
  | "revenue"
  | "bookings"
  | "rating"
  | "response_time"
  | "completion_rate"
  | "repeat_customers"
  | "custom";

export type BusinessOverviewMetrics = {
  revenue: number;
  bookings: number;
  acceptanceRate: number;
  completionRate: number;
  cancellationRate: number;
  responseTimeMin: number | null;
  customerSatisfaction: number | null;
  trustLevel: number;
  reputationTrend: BusinessTrend;
  capacityUsage: number;
  businessHealthScore: number;
  currency: string;
};

export type BusinessInsight = {
  id?: string;
  code: string;
  category: string;
  labelEn: string;
  labelAr?: string;
  severity: "info" | "positive" | "warning" | "critical";
};

export type BusinessRecommendation = {
  id?: string;
  code: string;
  titleEn: string;
  titleAr?: string;
  bodyEn?: string;
  bodyAr?: string;
  priority: number;
  status?: string;
};

export type GrowthOpportunity = {
  code: string;
  titleEn: string;
  titleAr?: string;
  kind:
    | "category"
    | "region"
    | "upsell"
    | "repeat"
    | "premium"
    | "partnership";
};

export type BusinessGoal = {
  id: string;
  goalType: BusinessGoalType;
  title: string;
  targetValue: number;
  currentValue: number;
  unit: string | null;
  period: string;
  progressPct: number;
  active: boolean;
};

export type BusinessBenchmark = {
  cohort: BusinessCohort;
  percentile: number | null;
  regionKey: string;
  categoryKey: string;
};

export type MorningBriefing = {
  briefingDate: string;
  summaryEn: string;
  summaryAr?: string;
  todaysBookings: number;
  revenueForecast: number | null;
  busyHours: string[];
  idleGaps: string[];
  highDemandRegions: string[];
  recommendedOpportunities: string[];
  reminders: string[];
  algorithmVersion: string;
  advisoryNotice: string;
};

export type ProviderBusinessAssistant = {
  overview: BusinessOverviewMetrics;
  briefing: MorningBriefing | null;
  insights: BusinessInsight[];
  recommendations: BusinessRecommendation[];
  growth: GrowthOpportunity[];
  goals: BusinessGoal[];
  benchmark: BusinessBenchmark | null;
  algorithmVersion: string;
  latencyMs: number;
};

export type AdminBusinessInsights = {
  marketplaceGrowthPct: number | null;
  providerGrowthCount: number;
  regionalOpportunities: Array<{ regionKey: string; demandIndex: number }>;
  categoryOpportunities: Array<{ categoryKey: string; demandIndex: number }>;
  healthDistribution: {
    healthy: number;
    average: number;
    atRisk: number;
  };
  recentBriefings: number;
  modelVersion: string;
};

export const BUSINESS_ADVISORY_NOTICE =
  "Advisory coaching only — Dalily never forces provider decisions.";
