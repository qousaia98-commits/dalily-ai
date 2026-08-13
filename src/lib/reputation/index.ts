/** Sprint 7 Phase 3 — AI Reputation Engine barrel. */

export { computeReputationFromSignals, mergeWeights } from "@/lib/reputation/engine";
export { recalculateProviderReputation } from "@/lib/reputation/service";
export { getPublicTrustView } from "@/lib/reputation/public";
export { getProviderReputationInsights } from "@/lib/reputation/insights";
export {
  getAdminReputationDashboard,
  getAdminProviderReputationDetail,
} from "@/lib/reputation/admin";
export { mapScoreToTrustLevel, publicTrustLevel, trustLevelBoost } from "@/lib/reputation/levels";
export { generateExplanations, pickPublicExplanations } from "@/lib/reputation/explanations";
export { SIGNAL_COLLECTORS, withMlSignalOverride } from "@/lib/reputation/signals";
export type {
  TrustLevel,
  ReputationComputation,
  PublicTrustView,
  ProviderReputationInsights,
} from "@/lib/reputation/types";
