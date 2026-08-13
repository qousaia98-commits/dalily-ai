/**
 * Predictive Intelligence adapter — prediction algorithms (Phase 8).
 * Orchestration for demand-forecasting product path lives in forecast-engine;
 * these modules remain the predictive model layer (wait time, balancer, etc.).
 */

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
} from "@/lib/ai/predictive";
