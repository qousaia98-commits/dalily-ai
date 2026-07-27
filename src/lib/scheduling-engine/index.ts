/** Sprint 8 Phase 4 — AI Scheduling barrel */

export { computeScheduleFromSignals } from "@/lib/scheduling-engine/engine";
export {
  SCHEDULE_SIGNAL_COLLECTORS,
  ML_SCHEDULER_COLLECTOR,
} from "@/lib/scheduling-engine/signals";
export {
  DEFAULT_SCHEDULE_WEIGHTS,
  mergeScheduleWeights,
} from "@/lib/scheduling-engine/weights";
export {
  buildScheduleExplanations,
  SCHEDULE_ADVISORY_NOTICE,
} from "@/lib/scheduling-engine/explanations";
export { collectScheduleRaw } from "@/lib/scheduling-engine/collect";
export { optimizeRoute } from "@/lib/scheduling-engine/routes";
export { detectScheduleGaps, fitsGapWithoutConflict } from "@/lib/scheduling-engine/gaps";
export { computeCapacitySnapshot } from "@/lib/scheduling-engine/capacity";
export {
  scoreOpportunities,
  syntheticGapCandidates,
} from "@/lib/scheduling-engine/opportunities";
export {
  optimizeProviderSchedule,
  toPublicDayOptimization,
  getProviderScheduleInsights,
  decideScheduleRecommendation,
  decideOpportunity,
  getCustomerScheduleHint,
  updateScheduleWeight,
  simulateSchedule,
  invalidateScheduleCache,
} from "@/lib/scheduling-engine/service";
export {
  getAdminScheduleDashboard,
  getScheduleHistoryReplay,
} from "@/lib/scheduling-engine/admin";
export {
  SCHEDULE_MODEL_VERSION,
  SCHEDULE_ML_VERSION,
} from "@/lib/scheduling-engine/types";
export type {
  ScheduleWeight,
  ScheduleRawSignals,
  ScheduleComputation,
  PublicDayOptimization,
  ProviderScheduleInsights,
  CustomerScheduleHint,
  ScheduleOpportunity,
  ScheduleGap,
  CapacitySnapshot,
} from "@/lib/scheduling-engine/types";
