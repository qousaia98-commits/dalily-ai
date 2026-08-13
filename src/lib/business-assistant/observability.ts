/**
 * Business assistant observability.
 */

import { getAuthUser } from "@/lib/auth/session";
import { logLearningEvent } from "@/lib/search/learning";

export type BusinessAssistantEvent =
  | "insight_generated"
  | "goal_achieved"
  | "recommendation_accepted"
  | "business_health_updated"
  | "briefing_generated"
  | "latency";

export async function trackBusinessAssistantEvent(
  event: BusinessAssistantEvent,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  try {
    const user = await getAuthUser();
    await logLearningEvent({
      eventType: "provider_clicked",
      providerId:
        typeof metadata.providerId === "string" ? metadata.providerId : null,
      customerId: user?.id ?? null,
      metadata: {
        source: "business_assistant",
        businessEvent: event,
        ...metadata,
      },
    });
  } catch {
    /* soft */
  }
}
