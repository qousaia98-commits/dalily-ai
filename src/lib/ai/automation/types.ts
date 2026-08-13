/** AI Engine Phase 9 — Autonomous Actions & Workflow Automation types. */

export type AutomationAudience = "customer" | "provider" | "admin" | "system";

export type AutomationDecisionMode =
  | "auto_execute"
  | "confirm"
  | "recommend"
  | "blocked";

export type AutomationActionStatus =
  | "recommended"
  | "pending_confirmation"
  | "executed"
  | "failed"
  | "rejected"
  | "modified"
  | "reversed"
  | "blocked_safety";

export type UserAutomationDecision =
  | "accepted"
  | "rejected"
  | "modified"
  | "ignored";

/** Actions that must never run without explicit human confirmation — and never auto. */
export const FORBIDDEN_AUTO_ACTIONS = [
  "payment",
  "legal_confirmation",
  "account_deletion",
  "identity_verification",
  "provider_suspension",
] as const;

export type ForbiddenAutoAction = (typeof FORBIDDEN_AUTO_ACTIONS)[number];

export type AutomationConfidencePolicy = {
  policyKey: string;
  /** 0.95 default — execute automatically */
  autoExecuteMin: number;
  /** 0.80 default — ask for confirmation when >= this and < autoExecuteMin */
  confirmMin: number;
  /** Below confirmMin → recommend only */
  recommendBelow: number;
  enabled: boolean;
};

export type WorkflowTrigger = {
  key: string;
  audience: AutomationAudience;
  descriptionEn: string;
};

export type WorkflowCondition = {
  key: string;
  satisfied: boolean;
  noteEn: string;
};

export type WorkflowDefinition = {
  id: string;
  nameEn: string;
  nameAr: string;
  audience: AutomationAudience;
  triggerKey: string;
  actionType: string;
  module: string;
  reversible: boolean;
  /** If true, action is in the hard safety deny-list for auto-exec. */
  safetyBlocked?: boolean;
};

export type WorkflowRunInput = {
  workflow: WorkflowDefinition;
  triggerKey: string;
  conditions: WorkflowCondition[];
  confidence: number;
  reasonEn: string;
  reasonAr: string;
  dataSources: string[];
  payload?: Record<string, unknown>;
  userId?: string | null;
  providerId?: string | null;
  serviceRequestId?: string | null;
  /** Optional executor — only called when decision is auto_execute */
  execute?: () => Promise<Record<string, unknown>>;
};

export type WorkflowRunResult = {
  version: 9;
  actionId: string | null;
  approvalId: string | null;
  workflowId: string;
  decisionMode: AutomationDecisionMode;
  status: AutomationActionStatus;
  confidence: number;
  reasonEn: string;
  reasonAr: string;
  dataSources: string[];
  result: Record<string, unknown>;
  reversible: boolean;
  module: string;
  createdAt: string;
};

export type AutomationSuggestion = {
  id?: string;
  workflowId: string;
  actionType: string;
  titleEn: string;
  titleAr: string;
  bodyEn: string;
  bodyAr: string;
  confidence: number;
  decisionMode: AutomationDecisionMode;
  status: AutomationActionStatus;
  reasonEn: string;
  reasonAr: string;
  dataSources: string[];
  reversible: boolean;
  payload?: Record<string, unknown>;
};

export type ProviderAutomationSettings = {
  providerId: string;
  autoAcceptEnabled: boolean;
  autoRejectOutOfArea: boolean;
  autoRejectOutsideHours: boolean;
  suggestRouteOptimization: boolean;
  suggestScheduleGaps: boolean;
  minAutoAcceptConfidence: number;
};

export type AdminAutomationDashboard = {
  version: 9;
  executedCount: number;
  pendingApprovals: number;
  accuracyPct: number | null;
  acceptanceRatePct: number | null;
  rejectedSuggestions: number;
  mostSuccessfulWorkflows: Array<{ workflowId: string; successCount: number }>;
  recentActions: Array<{
    id: string;
    workflowId: string;
    actionType: string;
    status: string;
    confidence: number | null;
    reasonEn: string;
    createdAt: string;
  }>;
  pending: Array<{
    id: string;
    actionId: string;
    titleEn: string;
    bodyEn: string;
    createdAt: string;
  }>;
};
