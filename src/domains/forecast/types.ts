/**
 * Canonical forecast + predictive types — Sprint 9.5 Phase 4.
 * Leaf re-exports only (client-safe when imported as types).
 */

export type {
  ForecastWeight,
  ForecastRawSignals,
  ForecastSignalResult,
  PublicDemandForecast,
  PublicForecastExplanation,
  ForecastComputation,
  ProviderForecastInsights,
  CustomerDemandHint,
  MarketIntelligenceSummary,
  ForecastHorizon,
  ForecastTrend,
  ForecastSignalKey,
} from "@/lib/forecast-engine/types";

export {
  FORECAST_MODEL_VERSION,
  FORECAST_ML_VERSION,
} from "@/lib/forecast-engine/types";

export type { AdminForecastDashboard } from "@/domains/forecast/view-types";

/** Predictive Intelligence (Phase 8) — distinct from Sprint-8 forecast-engine types */
export type {
  DemandForecastResult,
  DemandForecastPoint,
  AvailabilityForecast,
  WaitTimeEstimate,
  MarketplaceBalance,
  PredictiveNotification,
  MarketInsightBundle,
  AdminPredictiveDashboard,
  BalanceSeverity,
  BalanceAction,
  SeasonCode,
  DemandDriver,
} from "@/lib/ai/predictive/types";
