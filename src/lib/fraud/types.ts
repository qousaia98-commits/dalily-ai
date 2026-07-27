/** Sprint 7 Phase 5 — Fraud Detection & Risk Intelligence types */

export const FRAUD_EVENT_TYPES = [
  "multiple_provider_accounts",
  "multiple_customer_accounts",
  "repeated_failed_payments",
  "abnormal_refund_behaviour",
  "fake_review_network",
  "rating_manipulation",
  "repeated_cancelled_bookings",
  "no_show_patterns",
  "suspicious_messaging",
  "rapid_account_creation",
  "device_anomaly",
  "location_anomaly",
  "repeated_identity_changes",
  "policy_violation",
  "rule_extension",
  "other",
] as const;

export type FraudEventType = (typeof FRAUD_EVENT_TYPES)[number];

export const RISK_ENTITY_TYPES = [
  "provider",
  "customer",
  "booking",
  "payment",
  "review",
  "case",
  "account",
] as const;

export type RiskEntityType = (typeof RISK_ENTITY_TYPES)[number];

export const RISK_LEVELS = ["low", "medium", "high", "critical"] as const;
export type RiskLevel = (typeof RISK_LEVELS)[number];

export const INVESTIGATION_STATUSES = [
  "open",
  "in_progress",
  "awaiting_info",
  "escalated",
  "resolved",
  "closed",
  "false_positive",
] as const;

export type InvestigationStatus = (typeof INVESTIGATION_STATUSES)[number];

/** Configurable automated actions — never permanent suspend. */
export const FRAUD_AUTO_ACTIONS = [
  "flag_account",
  "require_manual_review",
  "require_identity_reverification",
  "temporary_feature_restriction",
  "escalate_to_admin",
] as const;

export type FraudAutoAction = (typeof FRAUD_AUTO_ACTIONS)[number];

export const RELATIONSHIP_TYPES = [
  "same_owner",
  "same_payment_method",
  "shared_booking",
  "shared_review",
  "shared_device",
  "shared_ip",
  "linked_case",
  "verification_link",
  "duplicate_candidate",
  "investigation_link",
  "other",
] as const;

export type RelationshipType = (typeof RELATIONSHIP_TYPES)[number];

export type FraudEvent = {
  id: string;
  eventType: FraudEventType;
  entityType: RiskEntityType;
  entityId: string;
  severity: RiskLevel;
  confidence: number;
  ruleKey: string | null;
  title: string;
  summary: string | null;
  relatedEntityIds: string[];
  metadata: Record<string, unknown>;
  source: "rule" | "heuristic" | "ml" | "manual" | "system";
  investigationId: string | null;
  resolvedAt: string | null;
  falsePositive: boolean;
  createdAt: string;
};

export type RiskScore = {
  entityType: RiskEntityType;
  entityId: string;
  internalScore: number;
  riskLevel: RiskLevel;
  confidence: number;
  explanation: string | null;
  triggeredRules: string[];
  suggestedAction: string | null;
  relatedEvents: string[];
  duplicateCandidates: string[];
  signalBreakdown: Record<string, number>;
  modelVersion: string;
  mlContribution: number;
  computedAt: string;
};

export type RiskRule = {
  id: string;
  ruleKey: string;
  category: string;
  title: string;
  description: string | null;
  weight: number;
  threshold: number;
  enabled: boolean;
  mlReady: boolean;
  autoActions: FraudAutoAction[];
};

export type Investigation = {
  id: string;
  caseNumber: string;
  title: string;
  status: InvestigationStatus;
  priority: "low" | "medium" | "high" | "urgent";
  primaryEntityType: RiskEntityType;
  primaryEntityId: string;
  relatedEntityIds: string[];
  assignedAdminId: string | null;
  outcome: string | null;
  mergedIntoId: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
};

export type InvestigationNote = {
  id: string;
  investigationId: string;
  authorId: string;
  body: string;
  createdAt: string;
};

export type InvestigationHistoryEntry = {
  id: string;
  investigationId: string;
  fromStatus: string | null;
  toStatus: string | null;
  action: string;
  actorId: string | null;
  note: string | null;
  createdAt: string;
};

export type EntityRelationship = {
  id: string;
  fromEntityType: RiskEntityType;
  fromEntityId: string;
  toEntityType: RiskEntityType;
  toEntityId: string;
  relationshipType: RelationshipType;
  confirmed: boolean;
  confidence: number;
  evidence: Record<string, unknown>;
};

export type RiskSignalResult = {
  signalKey: string;
  category: string;
  rawValue: number;
  normalizedValue: number;
  weight: number;
  contribution: number;
  source: "rule" | "heuristic" | "ml";
  triggered: boolean;
  metadata?: Record<string, unknown>;
};

export type RiskComputation = {
  entityType: RiskEntityType;
  entityId: string;
  internalScore: number;
  riskLevel: RiskLevel;
  confidence: number;
  explanation: string;
  triggeredRules: string[];
  suggestedAction: FraudAutoAction | "none";
  signals: RiskSignalResult[];
  mlContribution: number;
  modelVersion: string;
};

export type AiRiskAnalysis = {
  explanation: string;
  triggeredRules: string[];
  confidence: number;
  severity: RiskLevel;
  suggestedAction: FraudAutoAction | "none";
  relatedEvents: string[];
  duplicateCandidates: string[];
  repeatBehaviour: boolean;
};

export const FRAUD_MODEL_VERSION = "fraud-rules-v1";
export const FRAUD_ML_LAYER_VERSION = "fraud-ml-ready-v0";

export const INVESTIGATION_TRANSITIONS: Record<
  InvestigationStatus,
  InvestigationStatus[]
> = {
  open: ["in_progress", "awaiting_info", "escalated", "false_positive", "closed"],
  in_progress: ["awaiting_info", "escalated", "resolved", "false_positive", "closed"],
  awaiting_info: ["in_progress", "escalated", "resolved", "closed"],
  escalated: ["in_progress", "resolved", "closed"],
  resolved: ["closed", "in_progress"],
  closed: ["in_progress"],
  false_positive: ["closed", "in_progress"],
};

export function canTransitionInvestigation(
  from: InvestigationStatus,
  to: InvestigationStatus,
): boolean {
  if (from === to) return false;
  return INVESTIGATION_TRANSITIONS[from]?.includes(to) ?? false;
}

export function scoreToRiskLevel(score: number): RiskLevel {
  if (score >= 80) return "critical";
  if (score >= 60) return "high";
  if (score >= 35) return "medium";
  return "low";
}
