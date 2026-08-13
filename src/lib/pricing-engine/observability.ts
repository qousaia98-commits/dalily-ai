/**
 * Pricing observability — never log internal formula dumps publicly.
 */

import { getAuthUser } from "@/lib/auth/session";
import { logLearningEvent } from "@/lib/search/learning";

export type PricingObservabilityEvent =
  | "pricing_calculated"
  | "recommendation_shown"
  | "provider_price_set"
  | "offer_accepted"
  | "latency";

export async function trackPricingEvent(
  event: PricingObservabilityEvent,
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
        source: "pricing_engine",
        pricingEvent: event,
        ...safe,
      },
    });
  } catch {
    /* soft */
  }
}
