/**
 * Client-safe matching public surface.
 *
 * Use this from `"use client"` modules instead of `@/domains/matching`
 * so Next.js does not pull server-only code (next/headers / admin client).
 *
 * Server Components, actions, and pages may use `@/domains/matching`.
 *
 * @see docs/architecture/matching.md
 */

export {
  MATCH_REASON_CODES,
  type MatchReason,
  type MatchReasonCode,
} from "@/domains/matching/reasons";

export type {
  MatchPoolSummary,
  MatchAssignmentView,
  AdminMatchingDashboard,
} from "@/domains/matching/view-types";

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
