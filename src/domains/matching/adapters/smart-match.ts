/**
 * Compatibility adapter — legacy directory smart-match.
 *
 * Implementation lives in src/lib/search/smart-match (LEGACY salvage host).
 * UI / actions / pages must import through @/domains/matching, not deep paths.
 *
 * @see src/lib/search/smart-match/LEGACY.md
 * @see docs/architecture/matching.md
 */

export {
  SMART_MATCH_WEIGHTS,
  combineSmartMatchScore,
  resolveDynamicRadiusKm,
  analyzeServiceRequest,
  buildMatchReasons,
  fetchCompletedJobsByProviderIds,
  suggestRequestImprovements,
  applyFutureBoosts,
  resolveAvailabilityScore,
  type ServiceAdvisorInsight,
  type RequestOptimizerSuggestion,
  type FutureMatchSignals,
} from "@/lib/search/smart-match";

/**
 * Directory browse match reasons (id-based).
 * Not the same as marketplace MatchReason (code-based).
 */
export type {
  MatchReason as DirectoryMatchReason,
  MatchReasonId as DirectoryMatchReasonId,
} from "@/lib/search/smart-match/reasons";

/** @deprecated Prefer DirectoryMatchReason — alias for UI that already used MatchReason from smart-match */
export type { MatchReason as SearchBrowseMatchReason } from "@/lib/search/smart-match/reasons";
