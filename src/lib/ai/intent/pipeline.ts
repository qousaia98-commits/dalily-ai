import { hybridProblemDetector } from "@/lib/search/problem-detection";
import {
  detectLanguageHint,
  normalizeAiPhrase,
  scrubAiText,
} from "@/lib/ai/privacy/scrub";
import { AI_KNOWLEDGE_HIT_THRESHOLD } from "@/lib/ai/types";
import { lookupKnowledge } from "@/lib/ai/knowledge/lookup";
import { upsertKnowledgeFromDetection } from "@/lib/ai/knowledge/feedback";
import { emitAiLearningEvent } from "@/lib/ai/learning/events";
import {
  blendConfidence,
  detectComplexity,
  detectServiceType,
  detectSubcategory,
  detectUrgency,
  urgencyToMarketplace,
} from "@/lib/ai/urgency/detect";
import {
  calculateCompleteness,
  inferSignalsFromText,
} from "@/lib/ai/completeness/score";
import { buildSmartQuestions } from "@/lib/ai/questions/engine";
import { recommendWorkflow } from "@/lib/ai/recommendations/workflow";
import {
  lookupCachedDecision,
  storeCachedDecision,
} from "@/lib/ai/intent/cache";
import type { AiDecision } from "@/lib/ai/decision/types";
import type { AiResolveSource } from "@/lib/ai/types";

export type IntentPipelineInput = {
  text: string;
  hasPhoto?: boolean;
  hasLocation?: boolean;
  hasUrgencyConfirmed?: boolean;
  /** Skip cache read (e.g. after user correction). */
  bypassCache?: boolean;
};

/**
 * Phase 2 intent pipeline:
 * normalize → cache → knowledge → rules/hybrid LLM → enrich → store
 */
export async function runIntentPipeline(
  input: IntentPipelineInput,
): Promise<AiDecision | null> {
  const scrubbed = scrubAiText(input.text.trim());
  if (scrubbed.length < 8) return null;

  const normalized = normalizeAiPhrase(scrubbed);
  const language = detectLanguageHint(scrubbed);

  // 0) Cached intent
  if (!input.bypassCache) {
    const cached = await lookupCachedDecision(normalized, language);
    if (cached) {
      return enrichDecision(cached, scrubbed, input);
    }
  }

  // 1) Knowledge base
  const hit = await lookupKnowledge(scrubbed);
  let categorySlug: string | null = null;
  let subcategory: string | null = null;
  let confidence = 0;
  let problemId: string | null = null;
  let source: AiResolveSource = "unknown";
  let skippedLlm = false;
  let problemPriority: string | null = null;

  if (hit && hit.score >= AI_KNOWLEDGE_HIT_THRESHOLD) {
    categorySlug = hit.phrase.categorySlug;
    subcategory = hit.phrase.subcategory;
    confidence = hit.score;
    source = "knowledge";
    skippedLlm = true;
    void emitAiLearningEvent({
      eventType: "knowledge_hit",
      metadata: { categorySlug, score: hit.score, knowledgeId: hit.phrase.id },
    });
  } else {
    void emitAiLearningEvent({
      eventType: "knowledge_miss",
      metadata: { language },
    });

    // 2–3) Rules + LLM via hybrid detector
    const parsed = await hybridProblemDetector.detect(scrubbed);
    if (parsed.problem) {
      categorySlug = parsed.problem.category;
      confidence = parsed.problem.confidence;
      problemId = parsed.problem.problemId;
      problemPriority = parsed.problem.priority;
      const usedWeak =
        parsed.problem.confidence > 0 && parsed.problem.confidence < 0.4;
      source = usedWeak ? "llm" : "rules";
      if (source === "llm") {
        void emitAiLearningEvent({
          eventType: "llm_invoked",
          metadata: { categorySlug, confidence },
        });
      }
      void upsertKnowledgeFromDetection({
        text: scrubbed,
        categorySlug,
        confidence,
        source,
      });
    }
  }

  if (!categorySlug) return null;

  subcategory =
    subcategory ?? detectSubcategory({ text: scrubbed, categorySlug });

  const urgency = detectUrgency({
    text: scrubbed,
    categorySlug,
    problemPriority,
  });
  const complexity = detectComplexity({ text: scrubbed, categorySlug });
  const serviceType = detectServiceType({
    text: scrubbed,
    urgency: urgency.level,
    complexity,
  });

  const textSignals = inferSignalsFromText(scrubbed);
  const completeness = calculateCompleteness({
    hasDescription: scrubbed.length >= 8,
    hasCategory: Boolean(categorySlug),
    hasScopeDetail: Boolean(textSignals.hasScopeDetail || subcategory),
    hasPhoto: Boolean(input.hasPhoto),
    hasLocation: Boolean(input.hasLocation),
    hasMeasurements: Boolean(textSignals.hasMeasurements),
    hasUrgencyConfirmed: Boolean(input.hasUrgencyConfirmed),
    hasOngoingStatus: Boolean(textSignals.hasOngoingStatus),
  });

  const questions = buildSmartQuestions({
    text: scrubbed,
    categorySlug,
    subcategory,
    completeness,
  });

  const workflow = recommendWorkflow({
    urgency: urgency.level,
    complexity,
    serviceType,
    completenessScore: completeness.score,
  });

  const decision: AiDecision = {
    version: 2,
    categorySlug,
    subcategory,
    serviceType,
    urgency: urgency.level,
    urgencyScore: urgency.score,
    complexity,
    confidence: blendConfidence(confidence, urgency.score > 0.7 ? 0.85 : 0.6),
    completeness,
    questions,
    workflow,
    problemId,
    source,
    skippedLlm,
    language,
    marketplaceUrgency: urgencyToMarketplace(urgency.level),
  };

  void emitAiLearningEvent({
    eventType: "intent_suggested",
    metadata: {
      categorySlug,
      subcategory,
      urgency: decision.urgency,
      workflow: workflow.strategy,
      confidence: decision.confidence,
      source,
    },
  });

  void emitAiLearningEvent({
    eventType: "workflow_recommended",
    metadata: { strategy: workflow.strategy, reasonKey: workflow.reasonKey },
  });

  void storeCachedDecision({
    normalizedText: normalized,
    language,
    decision,
  });

  return decision;
}

function enrichDecision(
  base: AiDecision,
  text: string,
  input: IntentPipelineInput,
): AiDecision {
  const textSignals = inferSignalsFromText(text);
  const completeness = calculateCompleteness({
    hasDescription: text.length >= 8,
    hasCategory: Boolean(base.categorySlug),
    hasScopeDetail: Boolean(
      textSignals.hasScopeDetail || base.subcategory,
    ),
    hasPhoto: Boolean(input.hasPhoto),
    hasLocation: Boolean(input.hasLocation),
    hasMeasurements: Boolean(textSignals.hasMeasurements),
    hasUrgencyConfirmed: Boolean(input.hasUrgencyConfirmed),
    hasOngoingStatus: Boolean(textSignals.hasOngoingStatus),
  });
  const questions = buildSmartQuestions({
    text,
    categorySlug: base.categorySlug,
    subcategory: base.subcategory,
    completeness,
  });
  const workflow = recommendWorkflow({
    urgency: base.urgency,
    complexity: base.complexity,
    serviceType: base.serviceType,
    completenessScore: completeness.score,
  });
  return { ...base, completeness, questions, workflow };
}
