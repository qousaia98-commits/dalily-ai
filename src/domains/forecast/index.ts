/**
 * SAD Forecast domain — canonical public entry (Sprint 9.5 Phase 4).
 *
 * UI / Actions / Pages → @/domains/forecast → forecast-engine / predictive → DB
 *
 * `"use client"` modules must import from `@/domains/forecast/client`.
 *
 * @see docs/architecture/forecast.md
 */

export const FORECAST_DOMAIN = {
  service: "forecast",
  owns: [
    "forecast_models",
    "forecast_history",
    "forecast_results",
    "forecast_accuracy",
    "ai_demand_forecasts",
    "ai_wait_time_estimates",
    "ai_marketplace_balances",
    "ai_predictive_notifications",
  ],
  impl: [
    "src/domains/forecast",
    "src/lib/forecast-engine (runtime demand forecast engine)",
    "src/lib/ai/forecasting (thin AI bridge)",
    "src/lib/ai/predictive (predictive model layer)",
  ],
  status: "active",
  sprint: "9.5",
  featureFlag: "FORECAST_ENGINE",
  predictiveFlag: "PREDICTIVE_ENGINE",
  legacyAliasFlags: ["AI_DEMAND_FORECASTING", "AI_ENGINE_V8"],
} as const;

/* —— Forecast Engine —— */
export {
  computeForecastFromSignals,
  DEFAULT_FORECAST_WEIGHTS,
  mergeForecastWeights,
  generateForecast,
  generateMultiHorizonForecast,
  toPublicDemandForecast,
  getProviderForecastInsights,
  getCustomerDemandHint,
  getMarketIntelligence,
  updateForecastWeight,
  recordForecastAccuracy,
  refreshForecastMarketSnapshot,
  simulateForecast,
  acceptForecastInsight,
  getAdminForecastDashboard,
  getForecastHistoryReplay,
  FORECAST_MODEL_VERSION,
  FORECAST_ML_VERSION,
  FORECAST_ADVISORY_NOTICE,
  FORECAST_SIGNAL_COLLECTORS,
  ML_FORECAST_COLLECTOR,
} from "@/domains/forecast/adapters/engine";

/* —— AI Forecast Bridge —— */
export {
  forecastingModule,
  getPublicDemandForecasts,
} from "@/domains/forecast/adapters/ai-bridge";

/* —— Predictive models —— */
export {
  predictiveModule,
  forecastDemand,
  forecastProviderAvailability,
  estimateWaitTime,
  detectMarketplaceBalances,
  buildCustomerPredictiveNotifications,
  buildProviderPredictiveNotifications,
  persistPredictiveNotifications,
  markNotificationClicked,
  buildMarketInsights,
  calibrateDemandForecasts,
  buildAdminPredictiveDashboard,
  getSeason,
  isHoliday,
  weatherMultiplier,
  seasonalCategoryMultiplier,
} from "@/domains/forecast/adapters/predictive";

/* —— Types —— */
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
  AdminForecastDashboard,
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
} from "@/domains/forecast/types";
