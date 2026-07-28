/**
 * Forecast Engine — INTERNAL runtime (Sprint 8 Phase 3 demand forecasting).
 *
 * External consumers (UI, actions, pages) MUST import via `@/domains/forecast`.
 *
 * @see docs/architecture/forecast.md
 */

export { computeForecastFromSignals } from "@/lib/forecast-engine/engine";
export {
  FORECAST_SIGNAL_COLLECTORS,
  ML_FORECAST_COLLECTOR,
} from "@/lib/forecast-engine/signals";
export {
  DEFAULT_FORECAST_WEIGHTS,
  mergeForecastWeights,
} from "@/lib/forecast-engine/weights";
export {
  buildForecastExplanations,
  FORECAST_ADVISORY_NOTICE,
} from "@/lib/forecast-engine/explanations";
export { collectForecastRaw } from "@/lib/forecast-engine/collect";
export {
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
} from "@/lib/forecast-engine/service";
export {
  getAdminForecastDashboard,
  getForecastHistoryReplay,
} from "@/lib/forecast-engine/admin";
export {
  FORECAST_MODEL_VERSION,
  FORECAST_ML_VERSION,
} from "@/lib/forecast-engine/types";
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
} from "@/lib/forecast-engine/types";
