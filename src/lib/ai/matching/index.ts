/**
 * AI Matching Bridge (thin) — INTERNAL.
 *
 * Responsibilities: AI façade metadata, feature-flag routing into the Smart Matching
 * Engine vs legacy score module, telemetry hooks.
 *
 * External consumers MUST use `@/domains/matching` (adapters/ai-bridge).
 * Do not add marketplace business rules here; scarce-pool policy lives in domains/matching.
 *
 * @see docs/architecture/matching.md
 */
export { matchingModule } from "./facade";
export {
  scoreProviderMatch,
  rankProvidersByMatchScore,
  type MatchScoreCandidate,
  type MatchScoreContext,
} from "./score";
export {
  selectAssignmentsWithAiRanking,
  type AiRankedAssignment,
} from "./rank-with-ai";
