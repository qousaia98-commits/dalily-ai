import {
  getServiceKnowledge,
  listServiceKnowledgeByCategory,
  SERVICE_KNOWLEDGE_CATALOG,
} from "@/lib/ai/jobs/catalog";
import type { JobAnalysis, ServiceKnowledgeEntry } from "@/lib/ai/jobs/types";
import { clamp01 } from "@/lib/ai/types";
import { detectSubcategory } from "@/lib/ai/urgency/detect";

/**
 * Match free-text (+ optional category) to the best service knowledge entry.
 */
export function matchServiceKnowledge(input: {
  text: string;
  categorySlug?: string | null;
  subcategory?: string | null;
}): { entry: ServiceKnowledgeEntry; confidence: number } | null {
  const text = input.text.toLowerCase();
  const pool = input.categorySlug
    ? listServiceKnowledgeByCategory(input.categorySlug)
    : SERVICE_KNOWLEDGE_CATALOG;

  let best: { entry: ServiceKnowledgeEntry; score: number } | null = null;

  for (const entry of pool) {
    let score = 0;
    for (const kw of entry.matchKeywords) {
      if (text.includes(kw.toLowerCase())) score += 2;
    }
    if (
      input.subcategory &&
      entry.subcategory &&
      input.subcategory === entry.subcategory
    ) {
      score += 3;
    }
    if (input.categorySlug && entry.categorySlug === input.categorySlug) {
      score += 1;
    }
    if (!best || score > best.score) best = { entry, score };
  }

  // Fallback: first category entry with weak confidence
  if (!best || best.score === 0) {
    if (input.categorySlug) {
      const fallback = listServiceKnowledgeByCategory(input.categorySlug)[0];
      if (fallback) {
        return { entry: fallback, confidence: 0.35 };
      }
    }
    return null;
  }

  const confidence = clamp01(0.4 + best.score * 0.08);
  return { entry: best.entry, confidence: Math.min(0.95, confidence) };
}

export function buildJobAnalysisFromEntry(
  entry: ServiceKnowledgeEntry,
  confidence: number,
  text: string,
): JobAnalysis {
  const multi =
    entry.relatedTrades.length > 0 &&
    (/renovation|تجديد|damage|غرق|flood|kitchen|مطبخ كامل/i.test(text) ||
      entry.complexity === "complex");

  return {
    version: 4,
    serviceKey: entry.serviceKey,
    categorySlug: entry.categorySlug,
    subcategory: entry.subcategory,
    likelyRootCause: entry.commonCauses[0] ?? "Needs on-site diagnosis",
    requiredWork: [
      entry.typicalProblems[0] ?? "Inspect and repair",
      ...entry.requiredSkills.slice(0, 2),
    ],
    estimatedDuration: entry.duration,
    estimatedDifficulty: entry.complexity,
    estimatedWorkers: entry.workersTypical,
    potentialFollowUp: entry.followUpWork,
    tools: entry.typicalTools,
    materials: entry.commonMaterials,
    price: entry.price,
    relatedTrades: multi ? entry.relatedTrades : [],
    multiService: multi && entry.relatedTrades.length > 0,
    emergencyCapable: entry.emergencyCapable,
    certifications: entry.certifications,
    confidence,
    knowledgeSource: "catalog",
  };
}

/**
 * Full Phase 4 job analysis pipeline.
 */
export function analyzeJob(input: {
  text: string;
  categorySlug?: string | null;
  subcategory?: string | null;
  emergency?: boolean;
}): JobAnalysis | null {
  const trimmed = input.text.trim();
  if (trimmed.length < 4) return null;

  const subcategory =
    input.subcategory ??
    (input.categorySlug
      ? detectSubcategory({ text: trimmed, categorySlug: input.categorySlug })
      : null);

  const matched = matchServiceKnowledge({
    text: trimmed,
    categorySlug: input.categorySlug,
    subcategory,
  });
  if (!matched) return null;

  let analysis = buildJobAnalysisFromEntry(
    matched.entry,
    matched.confidence,
    trimmed,
  );

  // Multi-service overrides for known patterns
  const multi = detectMultiService({
    text: trimmed,
    categorySlug: analysis.categorySlug,
    entry: matched.entry,
  });
  if (multi.trades.length > 0) {
    analysis = {
      ...analysis,
      multiService: true,
      relatedTrades: multi.trades,
      potentialFollowUp: [
        ...new Set([...analysis.potentialFollowUp, ...multi.followUps]),
      ],
      confidence: clamp01(analysis.confidence + 0.05),
    };
  }

  if (input.emergency && analysis.emergencyCapable) {
    analysis = {
      ...analysis,
      estimatedDuration: {
        ...analysis.estimatedDuration,
        // Emergency: slightly longer max for access/parts uncertainty
        maxMinutes: Math.round(analysis.estimatedDuration.maxMinutes * 1.25),
        labelEn: analysis.estimatedDuration.labelEn.replace(
          /(\d+)–(\d+)/,
          (_, a, b) => `${a}–${Math.round(Number(b) * 1.25)}`,
        ),
      },
    };
  }

  return analysis;
}

export function detectMultiService(input: {
  text: string;
  categorySlug: string;
  entry: ServiceKnowledgeEntry;
}): { trades: string[]; followUps: string[] } {
  const t = input.text;
  if (/water damage|غرق|flood|رطوبة عالية/i.test(t)) {
    return {
      trades: ["plumbing", "painting", "carpentry"].filter(
        (x) => x !== input.categorySlug,
      ),
      followUps: ["Drywall repair", "Repaint affected walls"],
    };
  }
  if (/kitchen renovation|تجديد مطبخ|مطبخ كامل|remodel/i.test(t)) {
    return {
      trades: ["plumbing", "electrical", "carpentry", "painting"].filter(
        (x) => x !== input.categorySlug,
      ),
      followUps: ["Finishing snag list"],
    };
  }
  if (/bathroom renovation|تجديد حمام/i.test(t)) {
    return {
      trades: ["plumbing", "electrical", "painting", "carpentry"].filter(
        (x) => x !== input.categorySlug,
      ),
      followUps: ["Waterproofing check"],
    };
  }
  return { trades: [], followUps: [] };
}

export function resolveKnownService(serviceKey: string): ServiceKnowledgeEntry | null {
  return getServiceKnowledge(serviceKey);
}
