/**
 * Canonical matching types — single public type surface for Sprint 9.5 Phase 2.
 *
 * Leaf modules only (no server barrels). Safe for type-only client imports via client.ts.
 */

export type {
  MatchReason,
  MatchReasonCode,
} from "@/domains/matching/reasons";
export { MATCH_REASON_CODES } from "@/domains/matching/reasons";

export type { EligibleProviderCandidate } from "@/domains/matching/eligibility";

export type { RankedAssignment } from "@/domains/matching/rank";

export type { MatchingPolicySnapshot } from "@/domains/matching/policy";

export type {
  MatchPoolSummary,
  MatchAssignmentView,
  AdminMatchingDashboard,
} from "@/domains/matching/view-types";

/** Smart Matching Engine (src/lib/matching-engine) — canonical runtime types */
export type {
  MatchComputation,
  PublicMatchRecommendation,
  PublicMatchExplanation,
  MatchWeight,
  CustomerPreferences,
  ProviderCapacity,
} from "@/lib/matching-engine/types";

export {
  MATCHING_MODEL_VERSION,
  DEFAULT_FAIRNESS_PARAMS,
} from "@/lib/matching-engine/types";

/** AI bridge assignment shape (Phase 2 ranking path) — type-only */
export type { AiRankedAssignment } from "@/lib/ai/matching/rank-with-ai";
