/** Sprint 8 Phase 5 — AI Business Assistant barrel */

export {
  BUSINESS_MODEL_VERSION,
  BUSINESS_ML_VERSION,
  BUSINESS_ADVISORY_NOTICE,
} from "@/lib/business-assistant/types";
export { collectBusinessRaw } from "@/lib/business-assistant/collect";
export {
  generateInsights,
  generateRecommendations,
  generateGrowthOpportunities,
  generateMorningBriefing,
} from "@/lib/business-assistant/insights";
export { computeAnonymousBenchmark } from "@/lib/business-assistant/benchmarks";
export {
  getProviderBusinessAssistant,
  listProviderGoals,
  upsertBusinessGoal,
  decideRecommendation,
  invalidateBusinessAssistantCache,
} from "@/lib/business-assistant/service";
export {
  getAdminBusinessInsights,
  getAdminBusinessDashboard,
} from "@/lib/business-assistant/admin";
export type {
  BusinessOverviewMetrics,
  BusinessInsight,
  BusinessRecommendation,
  GrowthOpportunity,
  BusinessGoal,
  BusinessBenchmark,
  MorningBriefing,
  ProviderBusinessAssistant,
  AdminBusinessInsights,
  BusinessGoalType,
  BusinessCohort,
} from "@/lib/business-assistant/types";
