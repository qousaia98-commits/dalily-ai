/** Sprint 8 Phase 1 — Smart Matching Engine barrel */

export { computeMatchFromSignals } from "@/lib/matching-engine/engine";
export { MATCH_SIGNAL_COLLECTORS, ML_RANKER_COLLECTOR } from "@/lib/matching-engine/signals";
export { DEFAULT_MATCHING_WEIGHTS, mergeMatchingWeights } from "@/lib/matching-engine/weights";
export { computeFairnessBoost } from "@/lib/matching-engine/fairness";
export { buildMatchExplanations } from "@/lib/matching-engine/explanations";
export {
  rankProvidersSmartMatch,
  toPublicRecommendations,
  recordMatchFeedback,
  updateMatchingWeight,
  simulateMatching,
} from "@/lib/matching-engine/service";
export { getAdminMatchingDashboard } from "@/lib/matching-engine/admin";
export { getCustomerPreferences, upsertCustomerPreferences, learnFromMatchFeedback } from "@/lib/matching-engine/preferences";
export { getProviderCapacity, upsertProviderCapacity, isProviderAvailableNow } from "@/lib/matching-engine/capacity";
export { MATCHING_MODEL_VERSION, DEFAULT_FAIRNESS_PARAMS } from "@/lib/matching-engine/types";
export type {
  MatchComputation,
  PublicMatchRecommendation,
  PublicMatchExplanation,
  MatchWeight,
  CustomerPreferences,
  ProviderCapacity,
} from "@/lib/matching-engine/types";
