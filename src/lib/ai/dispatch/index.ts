/**
 * AI Engine Phase 3 — Smart Dispatch & Provider Intelligence.
 */
export type {
  ResponseBand,
  ExposureMode,
  EtaWindow,
  CapacityEstimate,
  RouteFit,
  ReputationBreakdown,
  DispatchExplanation,
  DispatchScoreResult,
  DispatchPlan,
  ProviderDispatchProfile,
} from "./types";

export { estimateCapacity, capacityScore } from "./capacity";
export { evaluateRouteFit, routeFitScore } from "./route";
export { predictResponse, responseBandScore } from "./response-prediction";
export { estimateEta } from "./eta";
export { computeReputation } from "./reputation";
export { planMarketplaceExposure } from "./exposure";
export {
  buildDispatchExplanations,
  toAssignmentExplanationBullets,
} from "./explanations";
export { scoreDispatchCandidate } from "./score";
export {
  loadProviderDispatchProfiles,
  resolveRequestAnchor,
} from "./context";
export { selectAssignmentsWithSmartDispatch } from "./select";
export type { DispatchRankedAssignment } from "./select";
export { persistDispatchPredictions, upsertProviderReputation } from "./predictions";
export { compareDispatchPrediction } from "./learning";

export const dispatchModule = {
  id: "dispatch",
  status: "phase3" as const,
  future: ["live traffic ETA", "realtime GPS tracking", "multi-stop packing"],
};
