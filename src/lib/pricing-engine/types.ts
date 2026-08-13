/** Sprint 8 Phase 2 — AI Dynamic Pricing types */

export const PRICING_MODEL_VERSION = "pricing-v1";
export const PRICING_ML_VERSION = "pricing-ml-v0";

export type PricingSignalKey =
  | "service_category"
  | "region"
  | "travel_distance"
  | "travel_time"
  | "job_complexity"
  | "estimated_duration"
  | "urgency"
  | "season"
  | "day_of_week"
  | "time_of_day"
  | "historical_prices"
  | "market_demand"
  | "provider_reputation"
  | "provider_experience"
  | "material_requirements"
  | "weather"
  | "holiday_calendar"
  | "repeat_customer"
  | "business_customer"
  | "large_project"
  | "ml_pricing";

export type PricingWeight = {
  signalKey: string;
  category: string;
  weight: number;
  enabled: boolean;
  mlReady: boolean;
  description?: string | null;
};

export type PricingRawSignals = {
  categoryKey: string;
  regionKey: string;
  currency: string;
  baseMarketAvg: number;
  baseMarketMin: number;
  baseMarketMax: number;
  distanceKm: number | null;
  travelTimeMin: number | null;
  complexity01: number;
  durationHours: number;
  urgency01: number;
  season01: number;
  weekend: boolean;
  peakHours: boolean;
  historicalAvg: number | null;
  demandIndex: number;
  reputationBoost: number | null;
  experience01: number;
  materials01: number;
  weather01: number;
  holiday: boolean;
  repeatCustomer: boolean;
  businessCustomer: boolean;
  largeProject: boolean;
  mlPriceFactor?: number | null;
};

export type PricingSignalResult = {
  signalKey: string;
  category: string;
  rawValue: number;
  factor: number;
  weight: number;
  contribution: number;
  source: "rule" | "heuristic" | "ml";
};

export type PublicPriceExplanation = {
  code: string;
  labelEn: string;
  labelAr?: string;
};

/** Public recommendation — never includes internal signal math */
export type PublicPriceRecommendation = {
  suggestedMin: number;
  suggestedAvg: number;
  suggestedPremium: number;
  currency: string;
  confidence: number;
  marketPosition: "budget" | "fair" | "premium";
  explanations: PublicPriceExplanation[];
  algorithmVersion: string;
};

export type PricingComputation = PublicPriceRecommendation & {
  signals: PricingSignalResult[];
  latencyMs: number;
  experimentId: string | null;
  categoryKey: string;
  regionKey: string;
};

export type ProviderPricingInsights = {
  suggested: PublicPriceRecommendation | null;
  marketAverage: number | null;
  pastAcceptedAvg: number | null;
  acceptanceRate: number | null;
  revenueTrendPct: number | null;
  competitiveness: "below" | "at" | "above" | "unknown";
  recommendations: string[];
  currency: string;
};
