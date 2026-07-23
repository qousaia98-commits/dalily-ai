export { SMART_MATCH_WEIGHTS, combineSmartMatchScore } from "./weights";
export { resolveDynamicRadiusKm } from "./dynamic-radius";
export { analyzeServiceRequest, type ServiceAdvisorInsight } from "./advisor";
export { buildMatchReasons, type MatchReason } from "./reasons";
export { fetchCompletedJobsByProviderIds } from "./completed-jobs";
export {
  suggestRequestImprovements,
  type RequestOptimizerSuggestion,
} from "./request-optimizer";
export {
  applyFutureBoosts,
  resolveAvailabilityScore,
  type FutureMatchSignals,
} from "./future-hooks";
