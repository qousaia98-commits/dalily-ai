/** Sprint 7 Phase 5 — Fraud Detection barrel */

export { computeRiskFromSignals } from "@/lib/fraud/engine";
export { collectEntityFraudRaw } from "@/lib/fraud/collect";
export { analyzeRiskComputation } from "@/lib/fraud/ai-analysis";
export { FRAUD_SIGNAL_COLLECTORS, ML_RISK_COLLECTOR } from "@/lib/fraud/signals";
export { DEFAULT_RISK_RULES, mergeRuleWeights } from "@/lib/fraud/weights";
export {
  recalculateEntityRisk,
  recordFraudEvent,
  createInvestigation,
  transitionInvestigation,
  assignInvestigation,
  addInvestigationNote,
  mergeInvestigations,
  confirmEntityRelationship,
  getInvestigationDetail,
  markFalsePositive,
} from "@/lib/fraud/service";
export { getAdminFraudDashboard, listConfirmedRelationships } from "@/lib/fraud/queries";
export {
  FRAUD_EVENT_TYPES,
  RISK_LEVELS,
  INVESTIGATION_STATUSES,
  FRAUD_AUTO_ACTIONS,
  canTransitionInvestigation,
  scoreToRiskLevel,
} from "@/lib/fraud/types";
export type {
  FraudEvent,
  RiskScore,
  Investigation,
  RiskEntityType,
  RiskLevel,
  AiRiskAnalysis,
  EntityRelationship,
} from "@/lib/fraud/types";
