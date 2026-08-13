/**
 * Marketplace intelligence observability (soft learning events).
 */

import { getAuthUser } from "@/lib/auth/session";
import { logLearningEvent } from "@/lib/search/learning";

export type MarketplaceIntelEvent =
  | "insight_generated"
  | "report_generated"
  | "simulation_executed"
  | "recommendation_accepted"
  | "recommendation_dismissed"
  | "algorithm_version"
  | "prediction_accuracy"
  | "system_latency"
  | "cache_performance";

export async function trackMarketplaceIntelEvent(
  event: MarketplaceIntelEvent,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  try {
    const user = await getAuthUser();
    await logLearningEvent({
      eventType: "provider_clicked",
      providerId: null,
      customerId: user?.id ?? null,
      metadata: {
        source: "marketplace_intelligence",
        marketplaceEvent: event,
        ...metadata,
      },
    });
  } catch {
    /* soft */
  }
}
