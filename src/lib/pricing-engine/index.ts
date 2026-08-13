/** Sprint 8 Phase 2 — AI Dynamic Pricing barrel */

export { computePriceFromSignals } from "@/lib/pricing-engine/engine";
export {
  PRICING_SIGNAL_COLLECTORS,
  ML_PRICING_COLLECTOR,
} from "@/lib/pricing-engine/signals";
export {
  DEFAULT_PRICING_WEIGHTS,
  mergePricingWeights,
} from "@/lib/pricing-engine/weights";
export { buildPricingExplanations } from "@/lib/pricing-engine/explanations";
export { collectPricingRaw } from "@/lib/pricing-engine/collect";
export {
  recommendPrice,
  toPublicPriceRecommendation,
  recordPricingFeedback,
  getProviderPricingInsights,
  updatePricingWeight,
  refreshMarketDataSnapshot,
  simulatePricing,
} from "@/lib/pricing-engine/service";
export {
  getAdminPricingDashboard,
  getPricingHistoryReplay,
} from "@/lib/pricing-engine/admin";
export { listMarketAnalytics } from "@/lib/pricing-engine/market";
export {
  PRICING_MODEL_VERSION,
  PRICING_ML_VERSION,
} from "@/lib/pricing-engine/types";
export type {
  PricingWeight,
  PricingRawSignals,
  PricingSignalResult,
  PublicPriceRecommendation,
  PublicPriceExplanation,
  PricingComputation,
  ProviderPricingInsights,
} from "@/lib/pricing-engine/types";
