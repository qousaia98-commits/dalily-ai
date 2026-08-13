/**
 * Public surface for the Smart Matching Engine (internal: src/lib/matching-engine).
 *
 * External callers (actions, pages, UI) must use @/domains/matching — never deep-import the engine.
 */

export {
  computeMatchFromSignals,
  MATCH_SIGNAL_COLLECTORS,
  ML_RANKER_COLLECTOR,
  DEFAULT_MATCHING_WEIGHTS,
  mergeMatchingWeights,
  computeFairnessBoost,
  buildMatchExplanations,
  rankProvidersSmartMatch,
  toPublicRecommendations,
  recordMatchFeedback,
  updateMatchingWeight,
  simulateMatching,
  getAdminMatchingDashboard,
  getCustomerPreferences,
  upsertCustomerPreferences,
  learnFromMatchFeedback,
  getProviderCapacity,
  upsertProviderCapacity,
  isProviderAvailableNow,
} from "@/lib/matching-engine";

export type {
  MatchComputation,
  PublicMatchRecommendation,
  PublicMatchExplanation,
  MatchWeight,
  CustomerPreferences,
  ProviderCapacity,
  AdminMatchingDashboard,
} from "@/domains/matching/types";
