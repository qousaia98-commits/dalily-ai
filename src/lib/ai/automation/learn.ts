/**
 * Learning loop — compare suggested automation vs user decision.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database.types";
import { emitAiLearningEvent } from "@/lib/ai/learning/events";
import type { UserAutomationDecision } from "./types";

const CONFIDENCE_DELTA: Record<UserAutomationDecision, number> = {
  accepted: 0.02,
  rejected: -0.04,
  modified: -0.01,
  ignored: -0.005,
};

export async function recordAutomationFeedback(input: {
  actionId: string;
  decision: UserAutomationDecision;
  modifiedPayload?: Record<string, unknown>;
  notes?: string;
}): Promise<{ ok: boolean; confidenceDelta: number }> {
  const delta = CONFIDENCE_DELTA[input.decision];

  try {
    const admin = createAdminClient();
    const { data: action } = await admin
      .from("ai_automation_actions")
      .select(
        "id, action_type, confidence, status, user_id, provider_id, service_request_id, workflow_id",
      )
      .eq("id", input.actionId)
      .maybeSingle();

    if (!action) return { ok: false, confidenceDelta: 0 };

    const confidenceBefore = Number(action.confidence ?? 0.5);

    await admin.from("ai_automation_feedback").insert({
      action_id: input.actionId,
      suggested_action: String(action.action_type),
      user_decision: input.decision,
      confidence_before: confidenceBefore,
      confidence_delta: delta,
      notes: input.notes ?? null,
    });

    const nextStatus =
      input.decision === "accepted"
        ? "executed"
        : input.decision === "rejected"
          ? "rejected"
          : input.decision === "modified"
            ? "modified"
            : action.status;

    await admin
      .from("ai_automation_actions")
      .update({
        status: nextStatus,
        resolved_at: new Date().toISOString(),
        result: {
          userDecision: input.decision,
          modifiedPayload: input.modifiedPayload ?? null,
        } as unknown as Json,
      })
      .eq("id", input.actionId);

    await admin
      .from("ai_automation_approvals")
      .update({
        status:
          input.decision === "accepted"
            ? "approved"
            : input.decision === "rejected"
              ? "rejected"
              : input.decision === "modified"
                ? "modified"
                : "expired",
        resolved_at: new Date().toISOString(),
        modified_payload: (input.modifiedPayload ?? null) as unknown as Json,
      })
      .eq("action_id", input.actionId)
      .eq("status", "pending");

    const eventType =
      input.decision === "accepted"
        ? "automation_confirmed"
        : input.decision === "rejected"
          ? "automation_rejected"
          : input.decision === "modified"
            ? "automation_modified"
            : "automation_suggested";

    void emitAiLearningEvent({
      eventType,
      customerId: action.user_id as string | null,
      providerId: action.provider_id as string | null,
      serviceRequestId: action.service_request_id as string | null,
      metadata: {
        actionId: input.actionId,
        workflowId: action.workflow_id,
        decision: input.decision,
        confidenceBefore,
        confidenceDelta: delta,
      },
    });

    return { ok: true, confidenceDelta: delta };
  } catch {
    return { ok: false, confidenceDelta: 0 };
  }
}
