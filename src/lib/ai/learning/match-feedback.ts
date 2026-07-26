import { emitAiLearningEvent } from "@/lib/ai/learning/events";
import type { AiUrgencyLevel } from "@/lib/ai/decision/types";

/**
 * Phase 2 learning loop helpers — append-only corrections.
 */
export async function learnFromProviderDecision(input: {
  kind: "accepted" | "rejected";
  providerId: string;
  serviceRequestId?: string | null;
  customerId?: string | null;
  matchScore?: number | null;
  reason?: string | null;
}): Promise<void> {
  await emitAiLearningEvent({
    eventType: input.kind === "accepted" ? "match_accepted" : "match_rejected",
    providerId: input.providerId,
    serviceRequestId: input.serviceRequestId,
    customerId: input.customerId,
    metadata: {
      matchScore: input.matchScore ?? null,
      reason: input.reason ?? null,
    },
  });

  // Alias to foundation vocabulary used by analytics.
  await emitAiLearningEvent({
    eventType:
      input.kind === "accepted" ? "provider_accepted" : "provider_declined",
    providerId: input.providerId,
    serviceRequestId: input.serviceRequestId,
    customerId: input.customerId,
    metadata: { matchScore: input.matchScore ?? null },
  });
}

export async function learnFromUrgencyCorrection(input: {
  suggested: AiUrgencyLevel;
  final: AiUrgencyLevel;
  serviceRequestId?: string | null;
  customerId?: string | null;
}): Promise<void> {
  if (input.suggested === input.final) return;
  await emitAiLearningEvent({
    eventType: "urgency_corrected",
    serviceRequestId: input.serviceRequestId,
    customerId: input.customerId,
    metadata: {
      from: input.suggested,
      to: input.final,
    },
  });
}

export async function learnFromWorkflowOverride(input: {
  suggested: string;
  final: string;
  serviceRequestId?: string | null;
}): Promise<void> {
  if (input.suggested === input.final) return;
  await emitAiLearningEvent({
    eventType: "workflow_overridden",
    serviceRequestId: input.serviceRequestId,
    metadata: { from: input.suggested, to: input.final },
  });
}
