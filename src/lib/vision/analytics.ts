/**
 * Anonymous Vision analytics — reuses learning_events (Smart Map pattern).
 * Never stores images or exact location.
 */

import { getAuthUser } from "@/lib/auth/session";
import { logLearningEvent } from "@/lib/search/learning";
import type { VisionAnalyticsEvent } from "@/lib/vision/types";

export async function trackVisionAnalytics(
  event: VisionAnalyticsEvent,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  const user = await getAuthUser();

  // Map to existing learning_events types (same pattern as Smart Map).
  const eventType =
    event === "provider_selected"
      ? ("recommendation_chosen" as const)
      : ("recommendation_shown" as const);

  await logLearningEvent({
    eventType,
    customerId: user?.id ?? null,
    metadata: {
      source: "ai_vision",
      visionEvent: event,
      ...metadata,
    },
  });
}
