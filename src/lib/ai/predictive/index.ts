/**
 * AI Engine Phase 8 — Predictive Intelligence & Autonomous Optimization.
 *
 * Prediction algorithms (demand history, wait time, balancer, notifications).
 * Demand-forecast product orchestration for Sprint 8 admin/provider UI lives in
 * `src/lib/forecast-engine` — do not duplicate orchestration here.
 *
 * External consumers MUST use `@/domains/forecast`.
 *
 * @see docs/architecture/forecast.md
 */

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
} from "./types";

export { forecastDemand } from "./demand";
export { forecastProviderAvailability } from "./availability";
export { estimateWaitTime } from "./wait-time";
export { detectMarketplaceBalances } from "./balancer";
export {
  buildCustomerPredictiveNotifications,
  buildProviderPredictiveNotifications,
  persistPredictiveNotifications,
  markNotificationClicked,
} from "./notifications";
export { buildMarketInsights } from "./insights";
export { calibrateDemandForecasts } from "./optimize";
export { buildAdminPredictiveDashboard } from "./dashboard";
export {
  getSeason,
  isHoliday,
  weatherMultiplier,
  seasonalCategoryMultiplier,
} from "./calendar";

export const predictiveModule = {
  id: "predictive",
  status: "phase8" as const,
  impl: [
    "src/domains/forecast (public API)",
    "src/lib/ai/predictive/demand.ts",
    "src/lib/ai/predictive/availability.ts",
    "src/lib/ai/predictive/balancer.ts",
    "src/lib/ai/predictive/dashboard.ts",
  ],
  responsibilities: ["predictionModels", "calendarPriors", "notifications"] as const,
  future: ["live weather API", "city-level heatmap tiles", "auto pool expansion"],
};
