/**
 * Quality case observability.
 */

import { getAuthUser } from "@/lib/auth/session";
import { logLearningEvent } from "@/lib/search/learning";

export type QualityObservabilityEvent =
  | "case_created"
  | "evidence_uploaded"
  | "status_changed"
  | "case_assigned"
  | "case_escalated"
  | "case_resolved"
  | "ai_analysis_completed";

export async function trackQualityEvent(
  event: QualityObservabilityEvent,
  metadata: Record<string, unknown> & {
    providerId?: string | null;
    caseId?: string;
  },
): Promise<void> {
  try {
    const user = await getAuthUser();
    await logLearningEvent({
      eventType: "provider_clicked",
      providerId: metadata.providerId ?? null,
      customerId: user?.id ?? null,
      metadata: {
        source: "quality_cases",
        qualityEvent: event,
        ...metadata,
      },
    });
  } catch {
    /* soft */
  }
}
