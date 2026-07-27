/** Sprint 8 Phase 3 — AI Demand Forecasting types */

export const FORECAST_MODEL_VERSION = "forecast-v1";
export const FORECAST_ML_VERSION = "forecast-ml-v0";

export type ForecastHorizon = "24h" | "7d" | "30d" | "90d";

export type ForecastTrend = "rising" | "stable" | "declining";

export type ForecastSignalKey =
  | "historical_bookings"
  | "category_demand"
  | "regional_demand"
  | "seasonality"
  | "weekday_patterns"
  | "time_of_day"
  | "holiday_calendar"
  | "weather"
  | "school_holidays"
  | "business_events"
  | "provider_availability"
  | "pricing_trends"
  | "cancellation_trends"
  | "complaint_trends"
  | "economic_indicators"
  | "ml_forecast";

export type ForecastWeight = {
  signalKey: string;
  category: string;
  weight: number;
  enabled: boolean;
  mlReady: boolean;
  description?: string | null;
};

export type ForecastRawSignals = {
  categoryKey: string;
  regionKey: string;
  horizon: ForecastHorizon;
  historicalIndex: number;
  categoryDemandIndex: number;
  regionalDemandIndex: number;
  seasonality01: number;
  weekdayBoost: number;
  timeOfDayBoost: number;
  holiday: boolean;
  schoolHoliday: boolean;
  businessEvent: boolean;
  weather01: number;
  providerAvailability01: number;
  pricingTrend01: number;
  cancellationRate01: number;
  complaintRate01: number;
  economic01: number;
  baselineDemand: number;
  mlDemandFactor?: number | null;
};

export type ForecastSignalResult = {
  signalKey: string;
  category: string;
  rawValue: number;
  factor: number;
  weight: number;
  contribution: number;
  source: "rule" | "heuristic" | "ml";
};

export type PublicForecastExplanation = {
  code: string;
  labelEn: string;
  labelAr?: string;
};

/** Public forecast — never includes internal signal math */
export type PublicDemandForecast = {
  horizon: ForecastHorizon;
  expectedDemand: number;
  confidence: number;
  trend: ForecastTrend;
  recommendedCapacity: number;
  explanations: PublicForecastExplanation[];
  algorithmVersion: string;
  advisoryNotice: string;
};

export type ForecastComputation = PublicDemandForecast & {
  signals: ForecastSignalResult[];
  latencyMs: number;
  experimentId: string | null;
  categoryKey: string;
  regionKey: string;
  modelKey: string;
};

export type ProviderForecastInsights = {
  horizons: PublicDemandForecast[];
  recommendedStaffing: number | null;
  bestWorkingHours: string[];
  busyPeriods: string[];
  revenueOpportunity: number | null;
  suggestedVacationWindows: string[];
  currency: string;
};

export type CustomerDemandHint = {
  demandLevel: "low" | "moderate" | "high";
  bookEarly: boolean;
  fasterAvailability: boolean;
  estimatedAvailability: "scarce" | "normal" | "ample";
  explanations: PublicForecastExplanation[];
  advisoryNotice: string;
};

export type MarketIntelligenceSummary = {
  growingCategories: string[];
  decliningCategories: string[];
  regionalShifts: Array<{ regionKey: string; demandIndex: number }>;
  bookingVelocity: number | null;
  seasonalNote: string | null;
};
