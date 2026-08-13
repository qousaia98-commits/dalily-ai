import { hybridProblemDetector } from "@/lib/search/problem-detection";
import { detectLanguageHint } from "@/lib/ai/privacy/scrub";
import { AI_KNOWLEDGE_HIT_THRESHOLD } from "@/lib/ai/types";
import { lookupKnowledge } from "@/lib/ai/knowledge/lookup";
import { upsertKnowledgeFromDetection } from "@/lib/ai/knowledge/feedback";
import { emitAiLearningEvent } from "@/lib/ai/learning/events";
import type { IntentResolveResult } from "@/lib/ai/intent/types";

/**
 * Resolve intent category with fast knowledge lookup before LLM.
 *
 * Flow: knowledge (high confidence) → hybrid rules/LLM → optional store.
 */
export async function resolveIntentCategory(
  rawText: string,
): Promise<IntentResolveResult | null> {
  const trimmed = rawText.trim();
  if (trimmed.length < 8) return null;

  const language = detectLanguageHint(trimmed);

  // 1) Knowledge base fast path
  const hit = await lookupKnowledge(trimmed);
  if (hit && hit.score >= AI_KNOWLEDGE_HIT_THRESHOLD) {
    void emitAiLearningEvent({
      eventType: "knowledge_hit",
      metadata: {
        categorySlug: hit.phrase.categorySlug,
        score: hit.score,
        knowledgeId: hit.phrase.id,
      },
    });

    return {
      categorySlug: hit.phrase.categorySlug,
      subcategory: hit.phrase.subcategory,
      confidence: hit.score,
      source: "knowledge",
      problemId: null,
      skippedLlm: true,
      language,
      hypothesizedUrgency: "normal",
    };
  }

  void emitAiLearningEvent({
    eventType: "knowledge_miss",
    metadata: { language },
  });

  // 2) Existing hybrid detector (rules → LLM)
  const parsed = await hybridProblemDetector.detect(trimmed);
  if (!parsed.problem) return null;

  const usedWeakRule =
    parsed.problem.confidence > 0 && parsed.problem.confidence < 0.4;
  const source: IntentResolveResult["source"] = usedWeakRule ? "llm" : "hybrid";

  if (source === "llm") {
    void emitAiLearningEvent({
      eventType: "llm_invoked",
      metadata: {
        categorySlug: parsed.problem.category,
        confidence: parsed.problem.confidence,
      },
    });
  }

  void emitAiLearningEvent({
    eventType: "intent_suggested",
    metadata: {
      categorySlug: parsed.problem.category,
      confidence: parsed.problem.confidence,
      problemId: parsed.problem.problemId,
      source,
    },
  });

  void upsertKnowledgeFromDetection({
    text: trimmed,
    categorySlug: parsed.problem.category,
    confidence: parsed.problem.confidence,
    source,
  });

  return {
    categorySlug: parsed.problem.category,
    subcategory: null,
    confidence: parsed.problem.confidence,
    source,
    problemId: parsed.problem.problemId,
    skippedLlm: false,
    language,
    hypothesizedUrgency:
      parsed.problem.priority === "emergency" ? "emergency" : "normal",
  };
}
