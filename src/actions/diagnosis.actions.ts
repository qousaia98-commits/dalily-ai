"use server";

import { getAuthUser } from "@/lib/auth/session";
import { hybridProblemDetector } from "@/lib/search/problem-detection";
import { getDiagnosisDefinition } from "@/lib/diagnosis/engine";
import { logLearningEvent } from "@/lib/search/learning";
import type { ProblemId } from "@/lib/search/engine/types";

/**
 * Public — no auth gate, matches location.actions.ts/voice.actions.ts.
 * Reuses the existing hybridProblemDetector singleton; never modifies it.
 * Returns null whenever there's no wizard to show (unrecognized query,
 * a problem with no diagnosis entry, or any unexpected failure) so the
 * caller always has a safe "just search directly" fallback.
 */
export async function detectDiagnosisAction(
  query: string,
): Promise<{ problemId: ProblemId } | null> {
  const trimmed = query.trim();
  if (!trimmed) return null;

  try {
    const parsed = await hybridProblemDetector.detect(trimmed);
    const problemId = parsed.problem?.problemId ?? null;
    const definition = getDiagnosisDefinition(problemId);
    if (!definition) return null;
    return { problemId: definition.problemId };
  } catch {
    return null;
  }
}

export async function logDiagnosisEventAction(input: {
  eventType: "diagnosis_completed" | "diagnosis_abandoned";
  problemId: ProblemId;
  metadata: Record<string, unknown>;
}): Promise<void> {
  const authUser = await getAuthUser();
  await logLearningEvent({
    eventType: input.eventType,
    customerId: authUser?.id ?? null,
    metadata: { problemId: input.problemId, ...input.metadata },
  });
}
