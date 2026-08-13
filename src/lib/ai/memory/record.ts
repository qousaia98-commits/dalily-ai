import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database.types";
import {
  detectDialectHint,
  detectLanguageHint,
  normalizeAiPhrase,
  scrubAiText,
} from "@/lib/ai/privacy/scrub";
import type { RecordIntentMemoryInput } from "@/lib/ai/memory/types";
import { emitAiLearningEvent } from "@/lib/ai/learning/events";

/**
 * Append-only intent memory. Never overwrites history.
 * Failures are swallowed so AI never breaks the product path.
 */
export async function recordIntentMemory(
  input: RecordIntentMemoryInput,
): Promise<string | null> {
  try {
    const originalText = scrubAiText(input.originalText);
    if (originalText.length < 2) return null;

    const normalizedText = normalizeAiPhrase(originalText);
    const language = detectLanguageHint(originalText);
    const dialect = detectDialectHint(originalText, language);
    const admin = createAdminClient();

    const { data, error } = await admin
      .from("ai_intent_memory")
      .insert({
        service_request_id: input.serviceRequestId ?? null,
        customer_id: input.customerId ?? null,
        original_text: originalText,
        normalized_text: normalizedText,
        language,
        dialect,
        detected_category_slug: input.detectedCategorySlug ?? null,
        detected_subcategory: input.detectedSubcategory ?? null,
        confidence: input.confidence ?? null,
        questions_asked: (input.questionsAsked ?? []) as Json,
        final_category_slug: input.finalCategorySlug ?? null,
        final_category_id: input.finalCategoryId ?? null,
        source: input.source ?? "unknown",
        was_corrected: Boolean(input.wasCorrected),
        metadata: (input.metadata ?? {}) as Json,
      })
      .select("id")
      .single();

    if (error || !data) {
      if (process.env.NODE_ENV === "development") {
        console.warn("[ai_intent_memory]", error?.message ?? "insert failed");
      }
      return null;
    }

    void emitAiLearningEvent({
      eventType: "memory_recorded",
      customerId: input.customerId,
      serviceRequestId: input.serviceRequestId,
      metadata: {
        memoryId: data.id,
        source: input.source ?? "unknown",
        wasCorrected: Boolean(input.wasCorrected),
      },
    });

    return data.id as string;
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[ai_intent_memory]", error);
    }
    return null;
  }
}
