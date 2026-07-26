import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database.types";
import { normalizeAiPhrase } from "@/lib/ai/privacy/scrub";
import {
  AI_KNOWLEDGE_HIT_THRESHOLD,
  clamp01,
} from "@/lib/ai/types";
import type { KnowledgeLookupHit, KnowledgePhrase } from "@/lib/ai/knowledge/types";

function mapRow(row: {
  id: string;
  phrase: string;
  normalized_phrase: string;
  category_slug: string;
  subcategory: string | null;
  language: string;
  dialect: string | null;
  confidence: number | string;
  occurrences: number;
  confirmations: number;
  corrections: number;
  success_rate: number | string;
  last_used_at: string;
}): KnowledgePhrase {
  return {
    id: row.id,
    phrase: row.phrase,
    normalizedPhrase: row.normalized_phrase,
    categorySlug: row.category_slug,
    subcategory: row.subcategory,
    language: row.language,
    dialect: row.dialect,
    confidence: Number(row.confidence),
    occurrences: row.occurrences,
    confirmations: row.confirmations,
    corrections: row.corrections,
    successRate: Number(row.success_rate),
    lastUsedAt: row.last_used_at,
  };
}

/**
 * Fast knowledge lookup before LLM.
 * Exact normalized match first; returns null when below threshold.
 */
export async function lookupKnowledge(
  rawText: string,
  options?: { minScore?: number },
): Promise<KnowledgeLookupHit | null> {
  const normalized = normalizeAiPhrase(rawText);
  if (normalized.length < 3) return null;
  const minScore = options?.minScore ?? AI_KNOWLEDGE_HIT_THRESHOLD;

  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("ai_knowledge_phrases")
      .select("*")
      .eq("normalized_phrase", normalized)
      .order("confidence", { ascending: false })
      .limit(5);

    if (error || !data || data.length === 0) return null;

    let best: KnowledgeLookupHit | null = null;
    for (const row of data) {
      const phrase = mapRow(row);
      // Blend stored confidence with historical success.
      const score = clamp01(phrase.confidence * 0.65 + phrase.successRate * 0.35);
      if (!best || score > best.score) {
        best = { phrase, score };
      }
    }

    if (!best || best.score < minScore) return null;

    // Touch last_used (aggregate update — not history rewrite of memory).
    void admin
      .from("ai_knowledge_phrases")
      .update({
        last_used_at: new Date().toISOString(),
        occurrences: best.phrase.occurrences + 1,
        updated_at: new Date().toISOString(),
      } as never)
      .eq("id", best.phrase.id);

    return best;
  } catch {
    return null;
  }
}

export async function findKnowledgeByNormalized(
  normalizedPhrase: string,
  categorySlug: string,
  language: string,
): Promise<KnowledgePhrase | null> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("ai_knowledge_phrases")
      .select("*")
      .eq("normalized_phrase", normalizedPhrase)
      .eq("category_slug", categorySlug)
      .eq("language", language)
      .maybeSingle();
    if (error || !data) return null;
    return mapRow(data);
  } catch {
    return null;
  }
}

export async function insertKnowledgePhrase(input: {
  phrase: string;
  normalizedPhrase: string;
  categorySlug: string;
  subcategory?: string | null;
  language: string;
  dialect?: string | null;
  confidence: number;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const admin = createAdminClient();
    await admin.from("ai_knowledge_phrases").insert({
      phrase: input.phrase,
      normalized_phrase: input.normalizedPhrase,
      category_slug: input.categorySlug,
      subcategory: input.subcategory ?? null,
      language: input.language,
      dialect: input.dialect ?? null,
      confidence: clamp01(input.confidence),
      occurrences: 1,
      confirmations: 0,
      corrections: 0,
      success_rate: 0.5,
      metadata: (input.metadata ?? {}) as Json,
    });
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[ai_knowledge_phrases.insert]", error);
    }
  }
}

export async function updateKnowledgeAggregates(
  id: string,
  patch: {
    confidence?: number;
    confirmations?: number;
    corrections?: number;
    successRate?: number;
    occurrences?: number;
    categorySlug?: string;
    subcategory?: string | null;
  },
): Promise<void> {
  try {
    const admin = createAdminClient();
    const row: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
      last_used_at: new Date().toISOString(),
    };
    if (patch.confidence != null) row.confidence = clamp01(patch.confidence);
    if (patch.confirmations != null) row.confirmations = patch.confirmations;
    if (patch.corrections != null) row.corrections = patch.corrections;
    if (patch.successRate != null) row.success_rate = clamp01(patch.successRate);
    if (patch.occurrences != null) row.occurrences = patch.occurrences;
    if (patch.categorySlug != null) row.category_slug = patch.categorySlug;
    if (patch.subcategory !== undefined) row.subcategory = patch.subcategory;
    await admin.from("ai_knowledge_phrases").update(row as never).eq("id", id);
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[ai_knowledge_phrases.update]", error);
    }
  }
}
