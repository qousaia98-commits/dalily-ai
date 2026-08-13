/** AI Engine Phase 8 — Predictive Intelligence types. */

export type SeasonCode = "winter" | "spring" | "summer" | "autumn";

export type DemandDriver =
  | "day_of_week"
  | "hour"
  | "season"
  | "holiday"
  | "historical"
  | "emergency_rate"
  | "weather_ready";

export type DemandForecastPoint = {
  date: string; // YYYY-MM-DD
  hourBucket: number | null;
  cityId: string | null;
  categorySlug: string;
  predictedRequests: number;
  confidence: number;
  drivers: Array<{ code: DemandDriver; weight: number; noteEn: string }>;
};

export type DemandForecastResult = {
  version: 8;
  generatedAt: string;
  horizonDays: number;
  points: DemandForecastPoint[];
  highlightsEn: string[];
  highlightsAr: string[];
};

export type AvailabilityForecast = {
  providerId: string;
  date: string;
  predictedFreeHours: number;
  predictedBookings: number;
  acceptanceProbability: number;
  expectedWorkload: "light" | "moderate" | "heavy" | "overloaded";
  confidence: number;
  drivers: string[];
};

export type WaitTimeEstimate = {
  categorySlug: string;
  cityId: string | null;
  responseMinMinutes: number;
  responseMaxMinutes: number;
  arrivalMinMinutes: number;
  arrivalMaxMinutes: number;
  confidence: number;
  sampleSize: number;
  labelEn: string;
  labelAr: string;
};

export type BalanceSeverity =
  | "balanced"
  | "mild"
  | "shortage"
  | "critical_shortage"
  | "oversupply";

export type BalanceAction =
  | "expand_radius"
  | "increase_pool"
  | "public_marketplace"
  | "priority_dispatch"
  | "notify_providers"
  | "throttle_intake";

export type MarketplaceBalance = {
  categorySlug: string | null;
  cityId: string | null;
  openRequests: number;
  availableProviders: number;
  imbalanceRatio: number;
  severity: BalanceSeverity;
  recommendedActions: BalanceAction[];
  explanationEn: string;
  explanationAr: string;
};

export type PredictiveNotification = {
  id?: string;
  audience: "customer" | "provider" | "admin";
  type: string;
  titleEn: string;
  titleAr: string;
  bodyEn: string;
  bodyAr: string;
  payload?: Record<string, unknown>;
};

export type MarketInsightBundle = {
  version: 8;
  mostRequestedServices: Array<{ categorySlug: string; count: number }>;
  fastestGrowingCategories: Array<{ categorySlug: string; growthPct: number }>;
  averageCompletionMinutes: number | null;
  providerUtilizationPct: number | null;
  regionalDemand: Array<{ cityId: string | null; cityLabel: string; count: number }>;
  peakHours: Array<{ hour: number; count: number }>;
  predictionAccuracyPct: number | null;
};

export type AdminPredictiveDashboard = {
  demand: DemandForecastResult;
  balances: MarketplaceBalance[];
  insights: MarketInsightBundle;
  healthScore: number;
  averageResponseMinutes: number | null;
  completionTrendPct: number | null;
  predictionAccuracyPct: number | null;
  heatmap: Array<{ cityId: string | null; label: string; intensity: number }>;
};
