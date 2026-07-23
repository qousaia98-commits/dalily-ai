"use server";

import { getAuthUser } from "@/lib/auth/session";
import { logLearningEvent } from "@/lib/search/learning";

export type MapAnalyticsEvent =
  | "map_opened"
  | "marker_clicked"
  | "provider_selected"
  | "navigation_started";

/**
 * Anonymous Smart Map analytics — reuses learning_events with allowed types + metadata.
 * Never stores exact GPS coordinates.
 */
export async function trackMapEventAction(input: {
  event: MapAnalyticsEvent;
  providerId?: string | null;
}): Promise<{ success: boolean }> {
  const user = await getAuthUser();
  const eventType =
    input.event === "map_opened"
      ? ("recommendation_shown" as const)
      : input.event === "navigation_started"
        ? ("provider_clicked" as const)
        : ("recommendation_chosen" as const);

  await logLearningEvent({
    eventType,
    providerId: input.providerId ?? null,
    customerId: user?.id ?? null,
    metadata: { source: "smart_map", mapEvent: input.event },
  });

  return { success: true };
}
