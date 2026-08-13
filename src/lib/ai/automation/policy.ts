/**
 * Confidence policy + hard safety rules for autonomous actions.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import {
  FORBIDDEN_AUTO_ACTIONS,
  type AutomationConfidencePolicy,
  type AutomationDecisionMode,
  type ForbiddenAutoAction,
} from "./types";

const DEFAULT_POLICY: AutomationConfidencePolicy = {
  policyKey: "default",
  autoExecuteMin: 0.95,
  confirmMin: 0.8,
  recommendBelow: 0.8,
  enabled: true,
};

export function isForbiddenAutoAction(actionType: string): boolean {
  return (FORBIDDEN_AUTO_ACTIONS as readonly string[]).includes(actionType);
}

export function assertNotForbidden(actionType: string): void {
  if (isForbiddenAutoAction(actionType)) {
    throw new Error(`Safety block: ${actionType} cannot be automated`);
  }
}

export async function loadConfidencePolicy(): Promise<AutomationConfidencePolicy> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("ai_automation_policies")
      .select(
        "policy_key, auto_execute_min, confirm_min, recommend_below, enabled",
      )
      .eq("policy_key", "default")
      .maybeSingle();

    if (!data) return { ...DEFAULT_POLICY };

    return {
      policyKey: String(data.policy_key ?? "default"),
      autoExecuteMin: Number(data.auto_execute_min ?? 0.95),
      confirmMin: Number(data.confirm_min ?? 0.8),
      recommendBelow: Number(data.recommend_below ?? 0.8),
      enabled: data.enabled !== false,
    };
  } catch {
    return { ...DEFAULT_POLICY };
  }
}

export function resolveDecisionMode(input: {
  confidence: number;
  policy: AutomationConfidencePolicy;
  actionType: string;
  safetyBlocked?: boolean;
}): AutomationDecisionMode {
  if (
    input.safetyBlocked ||
    isForbiddenAutoAction(input.actionType as ForbiddenAutoAction | string)
  ) {
    return "blocked";
  }
  if (!input.policy.enabled) return "recommend";

  const c = Math.max(0, Math.min(1, input.confidence));
  if (c >= input.policy.autoExecuteMin) return "auto_execute";
  if (c >= input.policy.confirmMin) return "confirm";
  return "recommend";
}

export { DEFAULT_POLICY };
