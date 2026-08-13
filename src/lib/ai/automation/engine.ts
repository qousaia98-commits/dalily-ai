/**
 * Autonomous workflow engine.
 * Trigger → Conditions → AI Decision → Action → Result → Audit.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database.types";
import { emitAiLearningEvent } from "@/lib/ai/learning/events";
import { loadConfidencePolicy, resolveDecisionMode } from "./policy";
import type {
  AutomationActionStatus,
  WorkflowRunInput,
  WorkflowRunResult,
} from "./types";

function conditionsMet(conditions: WorkflowRunInput["conditions"]): boolean {
  if (!conditions.length) return true;
  return conditions.every((c) => c.satisfied);
}

async function persistAction(row: {
  workflowId: string;
  triggerKey: string;
  audience: string;
  actionType: string;
  status: AutomationActionStatus;
  confidence: number;
  decisionMode: string;
  reasonEn: string;
  reasonAr: string;
  dataSources: string[];
  payload: Record<string, unknown>;
  result: Record<string, unknown>;
  module: string;
  reversible: boolean;
  userId?: string | null;
  providerId?: string | null;
  serviceRequestId?: string | null;
}): Promise<string | null> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("ai_automation_actions")
      .insert({
        workflow_id: row.workflowId,
        trigger_key: row.triggerKey,
        audience: row.audience,
        action_type: row.actionType,
        status: row.status,
        confidence: row.confidence,
        decision_mode: row.decisionMode,
        reason_en: row.reasonEn,
        reason_ar: row.reasonAr,
        data_sources: row.dataSources as unknown as Json,
        payload: row.payload as unknown as Json,
        result: row.result as unknown as Json,
        module: row.module,
        reversible: row.reversible,
        user_id: row.userId ?? null,
        provider_id: row.providerId ?? null,
        service_request_id: row.serviceRequestId ?? null,
        resolved_at:
          row.status === "executed" ||
          row.status === "recommended" ||
          row.status === "blocked_safety"
            ? new Date().toISOString()
            : null,
      })
      .select("id")
      .single();

    if (error) return null;
    return (data?.id as string) ?? null;
  } catch {
    return null;
  }
}

async function persistApproval(input: {
  actionId: string;
  audience: string;
  userId?: string | null;
  providerId?: string | null;
  titleEn: string;
  titleAr: string;
  bodyEn: string;
  bodyAr: string;
}): Promise<string | null> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("ai_automation_approvals")
      .insert({
        action_id: input.actionId,
        audience: input.audience,
        user_id: input.userId ?? null,
        provider_id: input.providerId ?? null,
        title_en: input.titleEn,
        title_ar: input.titleAr,
        body_en: input.bodyEn,
        body_ar: input.bodyAr,
        status: "pending",
      })
      .select("id")
      .single();
    return (data?.id as string) ?? null;
  } catch {
    return null;
  }
}

/**
 * Run one workflow step with confidence gating, audit, and optional execution.
 */
export async function runWorkflow(
  input: WorkflowRunInput,
): Promise<WorkflowRunResult> {
  const createdAt = new Date().toISOString();
  const policy = await loadConfidencePolicy();
  const decisionMode = resolveDecisionMode({
    confidence: input.confidence,
    policy,
    actionType: input.workflow.actionType,
    safetyBlocked: input.workflow.safetyBlocked,
  });

  const base = {
    version: 9 as const,
    workflowId: input.workflow.id,
    confidence: input.confidence,
    reasonEn: input.reasonEn,
    reasonAr: input.reasonAr,
    dataSources: input.dataSources,
    reversible: input.workflow.reversible,
    module: input.workflow.module,
    createdAt,
  };

  if (!conditionsMet(input.conditions)) {
    return {
      ...base,
      actionId: null,
      approvalId: null,
      decisionMode: "recommend",
      status: "failed",
      result: {
        skipped: true,
        reason: "conditions_not_met",
        conditions: input.conditions,
      },
    };
  }

  if (decisionMode === "blocked") {
    const actionId = await persistAction({
      workflowId: input.workflow.id,
      triggerKey: input.triggerKey,
      audience: input.workflow.audience,
      actionType: input.workflow.actionType,
      status: "blocked_safety",
      confidence: input.confidence,
      decisionMode: "blocked",
      reasonEn: input.reasonEn,
      reasonAr: input.reasonAr,
      dataSources: input.dataSources,
      payload: input.payload ?? {},
      result: { blocked: true, safety: true },
      module: input.workflow.module,
      reversible: false,
      userId: input.userId,
      providerId: input.providerId,
      serviceRequestId: input.serviceRequestId,
    });

    void emitAiLearningEvent({
      eventType: "automation_blocked_safety",
      customerId: input.userId,
      providerId: input.providerId,
      serviceRequestId: input.serviceRequestId,
      metadata: {
        workflowId: input.workflow.id,
        actionType: input.workflow.actionType,
      },
    });

    return {
      ...base,
      actionId,
      approvalId: null,
      decisionMode: "blocked",
      status: "blocked_safety",
      result: { blocked: true },
    };
  }

  let status: AutomationActionStatus =
    decisionMode === "auto_execute"
      ? "executed"
      : decisionMode === "confirm"
        ? "pending_confirmation"
        : "recommended";

  let result: Record<string, unknown> = {
    decisionMode,
    conditions: input.conditions,
  };

  if (decisionMode === "auto_execute" && input.execute) {
    try {
      const execResult = await input.execute();
      result = { ...result, ...execResult, executed: true };
      status = "executed";
    } catch (err) {
      status = "failed";
      result = {
        ...result,
        executed: false,
        error: err instanceof Error ? err.message : "execute_failed",
      };
    }
  } else if (decisionMode === "auto_execute") {
    result = { ...result, executed: true, dryRun: false, note: "logged_auto" };
  }

  const actionId = await persistAction({
    workflowId: input.workflow.id,
    triggerKey: input.triggerKey,
    audience: input.workflow.audience,
    actionType: input.workflow.actionType,
    status,
    confidence: input.confidence,
    decisionMode,
    reasonEn: input.reasonEn,
    reasonAr: input.reasonAr,
    dataSources: input.dataSources,
    payload: input.payload ?? {},
    result,
    module: input.workflow.module,
    reversible: input.workflow.reversible,
    userId: input.userId,
    providerId: input.providerId,
    serviceRequestId: input.serviceRequestId,
  });

  let approvalId: string | null = null;
  if (decisionMode === "confirm" && actionId) {
    approvalId = await persistApproval({
      actionId,
      audience: input.workflow.audience === "system" ? "admin" : input.workflow.audience,
      userId: input.userId,
      providerId: input.providerId,
      titleEn: input.workflow.nameEn,
      titleAr: input.workflow.nameAr,
      bodyEn: input.reasonEn,
      bodyAr: input.reasonAr,
    });
  }

  void emitAiLearningEvent({
    eventType:
      decisionMode === "auto_execute"
        ? "automation_executed"
        : decisionMode === "confirm"
          ? "automation_suggested"
          : "automation_suggested",
    customerId: input.userId,
    providerId: input.providerId,
    serviceRequestId: input.serviceRequestId,
    metadata: {
      workflowId: input.workflow.id,
      decisionMode,
      status,
      confidence: input.confidence,
      actionId,
    },
  });

  void emitAiLearningEvent({
    eventType: "workflow_run",
    customerId: input.userId,
    providerId: input.providerId,
    serviceRequestId: input.serviceRequestId,
    metadata: {
      workflowId: input.workflow.id,
      triggerKey: input.triggerKey,
      decisionMode,
    },
  });

  return {
    ...base,
    actionId,
    approvalId,
    decisionMode,
    status,
    result,
  };
}

/**
 * Reverse a previously executed reversible action (audit only + mark reversed).
 */
export async function reverseAutomationAction(
  actionId: string,
  reasonEn = "Reversed by user",
): Promise<boolean> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("ai_automation_actions")
      .select("id, reversible, status, user_id, provider_id, service_request_id")
      .eq("id", actionId)
      .maybeSingle();

    if (!data || !data.reversible || data.status !== "executed") return false;

    await admin
      .from("ai_automation_actions")
      .update({
        status: "reversed",
        reversed_at: new Date().toISOString(),
        resolved_at: new Date().toISOString(),
        result: { reversed: true, reasonEn } as unknown as Json,
      })
      .eq("id", actionId);

    void emitAiLearningEvent({
      eventType: "automation_reversed",
      customerId: data.user_id as string | null,
      providerId: data.provider_id as string | null,
      serviceRequestId: data.service_request_id as string | null,
      metadata: { actionId, reasonEn },
    });

    return true;
  } catch {
    return false;
  }
}
