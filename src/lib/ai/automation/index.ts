/**
 * AI Engine Phase 9 — Autonomous Actions & Workflow Automation.
 */

export type {
  AutomationAudience,
  AutomationDecisionMode,
  AutomationActionStatus,
  AutomationConfidencePolicy,
  AutomationSuggestion,
  ProviderAutomationSettings,
  AdminAutomationDashboard,
  WorkflowDefinition,
  WorkflowRunResult,
  WorkflowCondition,
  ForbiddenAutoAction,
  UserAutomationDecision,
} from "./types";

export { FORBIDDEN_AUTO_ACTIONS } from "./types";

export {
  loadConfidencePolicy,
  resolveDecisionMode,
  isForbiddenAutoAction,
  DEFAULT_POLICY,
} from "./policy";

export { WORKFLOW_CATALOG, getWorkflow, listWorkflowsByAudience } from "./registry";

export { runWorkflow, reverseAutomationAction } from "./engine";

export { runCustomerAutomations } from "./customer";
export type { CustomerAutomationContext } from "./customer";

export {
  runProviderAutomations,
  getProviderAutomationSettings,
  upsertProviderAutomationSettings,
} from "./provider";
export type { ProviderAutomationContext } from "./provider";

export { runAdminAutomations } from "./admin";

export { recordAutomationFeedback } from "./learn";

export { buildAdminAutomationDashboard } from "./dashboard";

export const automationModule = {
  id: "automation",
  status: "phase9" as const,
  impl: [
    "src/lib/ai/automation/engine.ts",
    "src/lib/ai/automation/customer.ts",
    "src/lib/ai/automation/provider.ts",
    "src/lib/ai/automation/admin.ts",
    "src/lib/ai/automation/dashboard.ts",
  ],
  future: [
    "cron-triggered workflow scheduler",
    "multi-step branching workflows",
    "marketplace API auto-accept binding",
  ],
};
