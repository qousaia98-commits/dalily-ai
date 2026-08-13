/**
 * Client-safe Forecast public surface.
 * Use from `"use client"` modules instead of `@/domains/forecast`.
 */

export type {
  CustomerDemandHint,
  ProviderForecastInsights,
  ForecastHorizon,
  ForecastTrend,
  PublicDemandForecast,
  PublicForecastExplanation,
  AdminForecastDashboard,
  WaitTimeEstimate,
  PredictiveNotification,
  DemandForecastResult,
} from "@/domains/forecast/types";

export {
  FORECAST_MODEL_VERSION,
  FORECAST_ML_VERSION,
} from "@/lib/forecast-engine/types";

export { FORECAST_ADVISORY_NOTICE } from "@/lib/forecast-engine/explanations";
