/** Sprint 7 Phase 4 — Quality Assurance barrel */

export {
  createQualityCase,
  transitionQualityStatus,
  assignQualityCase,
  addQualityCaseMessage,
  uploadQualityEvidence,
  mergeQualityCases,
  getQualityCaseDetail,
  createCaseFromBookingIssue,
} from "@/lib/quality/service";
export {
  listQualityCasesForAdmin,
  listQualityCasesForCustomer,
  listQualityCasesForProvider,
  getAdminQualityDashboard,
  countOpenQualityCases,
} from "@/lib/quality/queries";
export {
  getProviderQualityInsights,
  recomputeProviderQualityMetrics,
} from "@/lib/quality/metrics";
export { analyzeQualityCase } from "@/lib/quality/ai-analysis";
export {
  QUALITY_CASE_CATEGORIES,
  QUALITY_CASE_STATUSES,
  canTransitionQualityStatus,
} from "@/lib/quality/types";
export type {
  QualityCase,
  QualityCaseCategory,
  QualityCaseStatus,
  ProviderQualityInsights,
} from "@/lib/quality/types";
