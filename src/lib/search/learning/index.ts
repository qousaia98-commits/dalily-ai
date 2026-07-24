export {
  LEARNING_MAX_ADJUSTMENT,
  PREFERENCE_MAX_ADJUSTMENT,
  type LearningEventType,
  type MatchConfidence,
  type ProviderPerformanceRow,
  type CustomerPreferenceProfile,
} from "./types";
export { resolveMatchConfidence } from "./confidence";
export { computeProviderPerformance } from "./performance-score";
export { applyLearningToSmartMatch } from "./engine";
export { applyLearningLayer } from "./layer";
export {
  logLearningEvent,
  fetchPerformanceScoresByProviderIds,
  fetchCustomerPreferenceProfile,
} from "./repository";
export {
  recomputeProviderPerformance,
  recomputeCustomerPreferences,
  scheduleLearningUpdate,
} from "./recompute";
export { type FutureMlModelSlot } from "./future-ml";
