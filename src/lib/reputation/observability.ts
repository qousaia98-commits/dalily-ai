/**
 * Reputation observability → learning events (never logs raw internal formulas publicly).
 */

import { getAuthUser } from "@/lib/auth/session";
import { logLearningEvent } from "@/lib/search/learning";

export type ReputationObservabilityEvent =
  | "reputation_recalculated"
  | "signal_updated"
  | "trust_level_changed"
  | "search_boost_changed"
  | "recommendation_boost_changed"
  | "trend_generated";

export async function trackReputationEvent(
  event: ReputationObservabilityEvent,
  metadata: Record<string, unknown> & { providerId?: string | null },
): Promise<void> {
  try {
    const user = await getAuthUser();
    await logLearningEvent({
      eventType: "provider_clicked",
      providerId: (metadata.providerId as string | null | undefined) ?? null,
      customerId: user?.id ?? null,
      metadata: {
        source: "ai_reputation_engine",
        reputationEvent: event,
        // Strip accidental score leaks
        internalScore: undefined,
        ...sanitize(metadata),
      },
    });
  } catch {
    /* soft */
  }
}

function sanitize(meta: Record<string, unknown>): Record<string, unknown> {
  const copy = { ...meta };
  delete copy.internalScore;
  delete copy.internal_score;
  delete copy.score;
  return copy;
}
