/**
 * Scheduling observability — never log internal formula dumps publicly.
 */

import { getAuthUser } from "@/lib/auth/session";
import { logLearningEvent } from "@/lib/search/learning";

export type ScheduleObservabilityEvent =
  | "optimization_executed"
  | "recommendation_accepted"
  | "recommendation_rejected"
  | "opportunity_accepted"
  | "opportunity_ignored"
  | "travel_reduction"
  | "revenue_increase"
  | "capacity_warning"
  | "latency";

export async function trackScheduleEvent(
  event: ScheduleObservabilityEvent,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  try {
    const user = await getAuthUser();
    const safe = { ...metadata };
    delete safe.signalBreakdown;
    delete safe.signals;
    delete safe.raw;
    await logLearningEvent({
      eventType: "provider_clicked",
      providerId:
        typeof metadata.providerId === "string" ? metadata.providerId : null,
      customerId: user?.id ?? null,
      metadata: {
        source: "scheduling_engine",
        scheduleEvent: event,
        ...safe,
      },
    });
  } catch {
    /* soft */
  }
}
