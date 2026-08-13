/**
 * Matching observability — no internal scores in public logs metadata dump.
 */

import { getAuthUser } from "@/lib/auth/session";
import { logLearningEvent } from "@/lib/search/learning";

export type MatchingObservabilityEvent =
  | "matching_calculated"
  | "recommendation_accepted"
  | "recommendation_ignored"
  | "booking_completed"
  | "repeat_booking"
  | "algorithm_version"
  | "latency";

export async function trackMatchingEvent(
  event: MatchingObservabilityEvent,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  try {
    const user = await getAuthUser();
    const safe = { ...metadata };
    delete safe.internalScore;
    delete safe.signalBreakdown;
    delete safe.raw;
    await logLearningEvent({
      eventType: "provider_clicked",
      providerId:
        typeof metadata.providerId === "string" ? metadata.providerId : null,
      customerId: user?.id ?? null,
      metadata: {
        source: "smart_matching_engine",
        matchingEvent: event,
        ...safe,
      },
    });
  } catch {
    /* soft */
  }
}
