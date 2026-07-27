/** Sprint 7 Phase 6 — AI Operations barrel */

export {
  refreshPlatformOps,
  acknowledgeAlert,
  resolveAlert,
  createOpsTask,
  completeOpsTask,
  buildOpsExportReport,
} from "@/lib/ai-ops/service";
export { getAiOpsDashboard } from "@/lib/ai-ops/queries";
export type { AiOpsDashboard } from "@/lib/ai-ops/queries";
export { buildHealthSnapshot } from "@/lib/ai-ops/health";
export { computeTrendsFromCounters } from "@/lib/ai-ops/trends";
export { detectAnomalies } from "@/lib/ai-ops/anomalies";
export { evaluateAlertRules } from "@/lib/ai-ops/alerts";
export { generateAiOpsInsights } from "@/lib/ai-ops/insights";
export {
  DEFAULT_ALERT_THRESHOLDS,
  AI_OPS_MODEL_VERSION,
} from "@/lib/ai-ops/types";
export type {
  PlatformHealthSnapshot,
  PlatformAlert,
  PlatformAnomaly,
  PlatformTrend,
  CategoryHealth,
  RegionHealth,
  AiOpsInsight,
} from "@/lib/ai-ops/types";
