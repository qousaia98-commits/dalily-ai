/**
 * AI Ops observability.
 */

import { getAuthUser } from "@/lib/auth/session";
import { logLearningEvent } from "@/lib/search/learning";

export type AiOpsObservabilityEvent =
  | "alert_created"
  | "alert_acknowledged"
  | "trend_generated"
  | "health_snapshot"
  | "anomaly_detected";

export async function trackAiOpsEvent(
  event: AiOpsObservabilityEvent,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  try {
    const user = await getAuthUser();
    await logLearningEvent({
      eventType: "provider_clicked",
      providerId: null,
      customerId: user?.id ?? null,
      metadata: {
        source: "ai_ops",
        aiOpsEvent: event,
        ...metadata,
      },
    });
  } catch {
    /* soft */
  }
}
