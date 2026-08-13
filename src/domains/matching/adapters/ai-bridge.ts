/**
 * AI Matching Bridge — thin public re-exports.
 *
 * Implementation: src/lib/ai/matching
 * Responsibilities of the bridge: façade, feature-flag routing, telemetry hooks.
 * Scoring algorithms remain internal to the bridge / engine; do not call them from UI.
 */

export { matchingModule } from "@/lib/ai/matching";
export {
  selectAssignmentsWithAiRanking,
  type AiRankedAssignment,
} from "@/lib/ai/matching";
export {
  scoreProviderMatch,
  rankProvidersByMatchScore,
  type MatchScoreCandidate,
  type MatchScoreContext,
} from "@/lib/ai/matching";
