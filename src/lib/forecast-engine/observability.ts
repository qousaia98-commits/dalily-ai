/**
 * Forecast observability — never log internal formula dumps publicly.
 */

import { getAuthUser } from "@/lib/auth/session";
import { logLearningEvent } from "@/lib/search/learning";

export type ForecastObservabilityEvent =
  | "forecast_generated"
  | "forecast_accepted"
  | "forecast_accuracy"
  | "model_version"
  | "latency";

export async function trackForecastEvent(
  event: ForecastObservabilityEvent,
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
        source: "forecast_engine",
        forecastEvent: event,
        ...safe,
      },
    });
  } catch {
    /* soft */
  }
}
