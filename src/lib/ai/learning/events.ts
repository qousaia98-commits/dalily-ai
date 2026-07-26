import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database.types";
import type { AiLearningEventInput } from "@/lib/ai/learning/types";
export { AI_LEARNING_EVENT_TYPES } from "@/lib/ai/learning/types";

/**
 * Append-only AI learning event. Never throws into the product path.
 * Reuses public.learning_events (extended CHECK in AI Foundation migration).
 */
export async function emitAiLearningEvent(
  input: AiLearningEventInput,
): Promise<void> {
  try {
    const admin = createAdminClient();
    await admin.from("learning_events").insert({
      event_type: input.eventType,
      provider_id: input.providerId ?? null,
      customer_id: input.customerId ?? null,
      service_request_id: input.serviceRequestId ?? null,
      search_log_id: input.searchLogId ?? null,
      metadata: (input.metadata ?? {}) as Json,
    });
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[ai_learning_events]", error);
    }
  }
}
