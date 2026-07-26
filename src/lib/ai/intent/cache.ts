import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database.types";
import type { AiDecision } from "@/lib/ai/decision/types";
import { emitAiLearningEvent } from "@/lib/ai/learning/events";
import { AI_KNOWLEDGE_HIT_THRESHOLD } from "@/lib/ai/types";

export async function lookupCachedDecision(
  normalizedText: string,
  language: string,
): Promise<AiDecision | null> {
  if (normalizedText.length < 3) return null;
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("ai_intent_decisions")
      .select("id, decision, confidence, hit_count")
      .eq("normalized_text", normalizedText)
      .eq("language", language)
      .maybeSingle();

    if (error || !data) return null;
    if (Number(data.confidence) < AI_KNOWLEDGE_HIT_THRESHOLD) return null;

    const decision = data.decision as unknown as AiDecision;
    if (!decision || decision.version !== 2) return null;

    void admin
      .from("ai_intent_decisions")
      .update({
        hit_count: (data.hit_count ?? 1) + 1,
        last_used_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as never)
      .eq("id", data.id);

    void emitAiLearningEvent({
      eventType: "intent_cached",
      metadata: { decisionId: data.id, categorySlug: decision.categorySlug },
    });

    return { ...decision, source: "cache", skippedLlm: true };
  } catch {
    return null;
  }
}

export async function storeCachedDecision(input: {
  normalizedText: string;
  language: string;
  decision: AiDecision;
}): Promise<void> {
  if (input.decision.confidence < AI_KNOWLEDGE_HIT_THRESHOLD) return;
  try {
    const admin = createAdminClient();
    const now = new Date().toISOString();
    await admin.from("ai_intent_decisions").upsert(
      {
        normalized_text: input.normalizedText,
        language: input.language,
        decision: input.decision as unknown as Json,
        confidence: input.decision.confidence,
        hit_count: 1,
        last_used_at: now,
        updated_at: now,
      },
      { onConflict: "normalized_text,language" },
    );
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[ai_intent_decisions]", error);
    }
  }
}
