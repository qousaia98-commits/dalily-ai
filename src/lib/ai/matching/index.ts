/**
 * Matching module — Phase 2 AI ranking + explanations.
 */
export { matchingModule } from "./facade";
export {
  scoreProviderMatch,
  rankProvidersByMatchScore,
  type MatchScoreCandidate,
  type MatchScoreContext,
} from "./score";
export { selectAssignmentsWithAiRanking } from "./rank-with-ai";
