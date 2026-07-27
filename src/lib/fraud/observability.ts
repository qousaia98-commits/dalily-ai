/**
 * Fraud observability — admin-only learning metadata, never public.
 */

import { getAuthUser } from "@/lib/auth/session";
import { logLearningEvent } from "@/lib/search/learning";

export type FraudObservabilityEvent =
  | "risk_calculated"
  | "rule_triggered"
  | "investigation_created"
  | "investigation_resolved"
  | "manual_override"
  | "false_positive";

export async function trackFraudEvent(
  event: FraudObservabilityEvent,
  metadata: Record<string, unknown> & {
    entityType?: string;
    entityId?: string;
    investigationId?: string;
  },
): Promise<void> {
  try {
    const user = await getAuthUser();
    await logLearningEvent({
      eventType: "provider_clicked",
      providerId: null,
      customerId: user?.id ?? null,
      metadata: {
        source: "fraud_detection",
        fraudEvent: event,
        ...sanitize(metadata),
      },
    });
  } catch {
    /* soft */
  }
}

function sanitize(meta: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(meta)) {
    if (k === "internalScore" || k === "raw") continue;
    out[k] = v;
  }
  return out;
}
