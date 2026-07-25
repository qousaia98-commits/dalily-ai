/**
 * SAD Matching domain — scarce request allocation (Sprint 3).
 * @see docs/migration/sprint-3-notes.md
 */

export const MATCHING_DOMAIN = {
  service: "matching",
  owns: ["match_pools", "match_assignments", "reason_codes"],
  impl: [
    "src/domains/matching",
    "src/lib/search/smart-match (salvage ideas only — no premium)",
  ],
  status: "active",
  sprint: 3,
  featureFlag: "MATCHING_V2",
} as const;

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
  type MatchRunResult,
} from "@/domains/matching/engine";
export {
  getMatchPoolSummaryForRequest,
  listMatchAssignmentsForRequest,
  type MatchPoolSummary,
  type MatchAssignmentView,
} from "@/domains/matching/queries";
