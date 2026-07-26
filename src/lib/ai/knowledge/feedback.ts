import {
  detectDialectHint,
  detectLanguageHint,
  normalizeAiPhrase,
  scrubAiText,
} from "@/lib/ai/privacy/scrub";
import {
  AI_CONFIRM_DELTA,
  AI_CORRECT_DELTA,
  AI_KNOWLEDGE_STORE_THRESHOLD,
  clamp01,
} from "@/lib/ai/types";
import { emitAiLearningEvent } from "@/lib/ai/learning/events";
import {
  findKnowledgeByNormalized,
  insertKnowledgePhrase,
  updateKnowledgeAggregates,
} from "@/lib/ai/knowledge/lookup";
import type { KnowledgeFeedbackKind } from "@/lib/ai/knowledge/types";

/**
 * Store or reinforce a detection into the knowledge base.
 */
export async function upsertKnowledgeFromDetection(input: {
  text: string;
  categorySlug: string;
  subcategory?: string | null;
  confidence: number;
  source: string;
}): Promise<void> {
  if (input.confidence < AI_KNOWLEDGE_STORE_THRESHOLD) return;
  const phrase = scrubAiText(input.text);
  const normalized = normalizeAiPhrase(phrase);
  if (normalized.length < 3) return;

  const language = detectLanguageHint(phrase);
  const dialect = detectDialectHint(phrase, language);
  const existing = await findKnowledgeByNormalized(
    normalized,
    input.categorySlug,
    language,
  );

  if (!existing) {
    await insertKnowledgePhrase({
      phrase,
      normalizedPhrase: normalized,
      categorySlug: input.categorySlug,
      subcategory: input.subcategory,
      language,
      dialect,
      confidence: input.confidence,
      metadata: { source: input.source },
    });
    return;
  }

  // Reinforce: move confidence toward the new signal.
  const nextConfidence = clamp01(
    existing.confidence * 0.7 + input.confidence * 0.3,
  );
  await updateKnowledgeAggregates(existing.id, {
    confidence: nextConfidence,
    occurrences: existing.occurrences + 1,
  });
}

/**
 * Feedback loop: confirm raises confidence; correct lowers and may retarget category.
 */
export async function applyKnowledgeFeedback(input: {
  text: string;
  kind: KnowledgeFeedbackKind;
  /** Category the system suggested (before user action). */
  suggestedCategorySlug?: string | null;
  /** Category the user finally chose. */
  finalCategorySlug: string;
  subcategory?: string | null;
  customerId?: string | null;
  serviceRequestId?: string | null;
}): Promise<void> {
  const phrase = scrubAiText(input.text);
  const normalized = normalizeAiPhrase(phrase);
  if (normalized.length < 3) return;

  const language = detectLanguageHint(phrase);
  const dialect = detectDialectHint(phrase, language);
  const suggested = input.suggestedCategorySlug ?? input.finalCategorySlug;

  const existing = await findKnowledgeByNormalized(
    normalized,
    suggested,
    language,
  );

  if (input.kind === "confirm") {
    if (existing) {
      const confirmations = existing.confirmations + 1;
      const total = confirmations + existing.corrections;
      const successRate = total > 0 ? confirmations / total : existing.successRate;
      await updateKnowledgeAggregates(existing.id, {
        confidence: clamp01(existing.confidence + AI_CONFIRM_DELTA),
        confirmations,
        successRate,
        occurrences: existing.occurrences + 1,
      });
    } else {
      await insertKnowledgePhrase({
        phrase,
        normalizedPhrase: normalized,
        categorySlug: input.finalCategorySlug,
        subcategory: input.subcategory,
        language,
        dialect,
        confidence: 0.7,
        metadata: { seededBy: "confirm" },
      });
    }

    void emitAiLearningEvent({
      eventType: "intent_confirmed",
      customerId: input.customerId,
      serviceRequestId: input.serviceRequestId,
      metadata: {
        categorySlug: input.finalCategorySlug,
        suggestedCategorySlug: suggested,
      },
    });
    return;
  }

  // Correction path
  if (existing) {
    const corrections = existing.corrections + 1;
    const total = existing.confirmations + corrections;
    const successRate = total > 0 ? existing.confirmations / total : 0.3;
    await updateKnowledgeAggregates(existing.id, {
      confidence: clamp01(existing.confidence - AI_CORRECT_DELTA),
      corrections,
      successRate,
    });
  }

  // Seed / reinforce the corrected category phrase.
  const corrected = await findKnowledgeByNormalized(
    normalized,
    input.finalCategorySlug,
    language,
  );
  if (corrected) {
    await updateKnowledgeAggregates(corrected.id, {
      confidence: clamp01(corrected.confidence + AI_CONFIRM_DELTA),
      confirmations: corrected.confirmations + 1,
      occurrences: corrected.occurrences + 1,
      successRate: clamp01(
        (corrected.confirmations + 1) /
          Math.max(1, corrected.confirmations + 1 + corrected.corrections),
      ),
    });
  } else {
    await insertKnowledgePhrase({
      phrase,
      normalizedPhrase: normalized,
      categorySlug: input.finalCategorySlug,
      subcategory: input.subcategory,
      language,
      dialect,
      confidence: 0.65,
      metadata: {
        seededBy: "correct",
        fromCategory: suggested,
      },
    });
  }

  void emitAiLearningEvent({
    eventType: "intent_corrected",
    customerId: input.customerId,
    serviceRequestId: input.serviceRequestId,
    metadata: {
      fromCategory: suggested,
      toCategory: input.finalCategorySlug,
    },
  });

  if (suggested !== input.finalCategorySlug) {
    void emitAiLearningEvent({
      eventType: "category_changed",
      customerId: input.customerId,
      serviceRequestId: input.serviceRequestId,
      metadata: {
        fromCategory: suggested,
        toCategory: input.finalCategorySlug,
      },
    });
  }
}
