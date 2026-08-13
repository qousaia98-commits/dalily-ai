/**
 * SAD Matching domain — canonical public entry for all matching (Sprint 9.5 Phase 2).
 *
 * Architecture:
 *   UI / Actions / Pages → @/domains/matching → matching-engine → AI bridge → scoring → DB
 *
 * `"use client"` modules must import from `@/domains/matching/client` instead,
 * to avoid pulling server-only modules into the client bundle.
 *
 * Do not deep-import @/lib/matching-engine, @/lib/ai/matching, or @/lib/search/smart-match
 * from UI, actions, or pages.
 *
 * @see docs/architecture/matching.md
 */

export const MATCHING_DOMAIN = {
  service: "matching",
  owns: ["match_pools", "match_assignments", "reason_codes"],
  impl: [
    "src/domains/matching",
    "src/lib/matching-engine (runtime engine)",
    "src/lib/ai/matching (thin AI bridge)",
    "src/lib/search/smart-match (legacy directory adapter only)",
  ],
  status: "active",
  sprint: "9.5",
  featureFlag: "MATCHING_V2",
  engineFlag: "SMART_MATCHING_ENGINE",
} as const;

/* —— Marketplace scarce matching (domain core) —— */
export { MATCH_REASON_CODES, type MatchReason, type MatchReasonCode } from "@/domains/matching/reasons";
export { MATCHING_POLICY, type MatchingPolicySnapshot } from "@/domains/matching/policy";
export {
  findEligibleProviderCandidates,
  type EligibleProviderCandidate,
} from "@/domains/matching/eligibility";
export {
  selectAssignmentsFromCandidates,
  type RankedAssignment,
} from "@/domains/matching/rank";
export {
  runMatchingForRequest,
  expandMatchPool,
  assignDirectProviderForRequest,
  type MatchRunResult,
  type DirectAssignResult,
} from "@/domains/matching/engine";
export {
  getMatchPoolSummaryForRequest,
  listMatchAssignmentsForRequest,
  type MatchPoolSummary,
  type MatchAssignmentView,
} from "@/domains/matching/queries";

/* —— Canonical types —— */
export {
  MATCHING_MODEL_VERSION,
  DEFAULT_FAIRNESS_PARAMS,
  type MatchComputation,
  type PublicMatchRecommendation,
  type PublicMatchExplanation,
  type MatchWeight,
  type CustomerPreferences,
  type ProviderCapacity,
  type AdminMatchingDashboard,
  type AiRankedAssignment,
} from "@/domains/matching/types";

/* —— Smart Matching Engine (via adapter) —— */
export {
  computeMatchFromSignals,
  DEFAULT_MATCHING_WEIGHTS,
  mergeMatchingWeights,
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
} from "@/domains/matching/adapters/engine";

/* —— AI bridge (via adapter) —— */
export {
  matchingModule,
  selectAssignmentsWithAiRanking,
  scoreProviderMatch,
  rankProvidersByMatchScore,
} from "@/domains/matching/adapters/ai-bridge";

/* —— Legacy directory smart-match (via adapter) —— */
export {
  suggestRequestImprovements,
  fetchCompletedJobsByProviderIds,
  analyzeServiceRequest,
  buildMatchReasons,
  resolveDynamicRadiusKm,
  type RequestOptimizerSuggestion,
  type ServiceAdvisorInsight,
  type DirectoryMatchReason,
  type DirectoryMatchReasonId,
  type SearchBrowseMatchReason,
} from "@/domains/matching/adapters/smart-match";
