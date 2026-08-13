/**
 * Forecast Engine adapter — runtime: src/lib/forecast-engine.
 */

export {
  computeForecastFromSignals,
  FORECAST_SIGNAL_COLLECTORS,
  ML_FORECAST_COLLECTOR,
  DEFAULT_FORECAST_WEIGHTS,
  mergeForecastWeights,
  buildForecastExplanations,
  FORECAST_ADVISORY_NOTICE,
  collectForecastRaw,
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
} from "@/lib/forecast-engine";
