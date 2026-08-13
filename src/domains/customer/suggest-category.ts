import { hybridProblemDetector } from "@/lib/search/problem-detection";
import { getLeafCategories } from "@/lib/categories/queries";
import { getLocalizedText } from "@/types/domain.types";
import type { CategorySuggestion, IntentUrgency } from "@/domains/customer/intent-types";
import {
  isAiEngineV1Enabled,
  isAiEngineV2Enabled,
} from "@/lib/config/feature-flags";
import { resolveIntentCategory } from "@/lib/ai/intent/resolve";
import { runIntentPipeline } from "@/lib/ai/intent/pipeline";
import type { AiDecision } from "@/lib/ai/decision/types";

function toUrgency(priority: string | undefined): IntentUrgency {
  return priority === "emergency" ? "emergency" : "normal";
}

function leafSuggestion(
  leaf: Awaited<ReturnType<typeof getLeafCategories>>[number],
  confidence: number,
  urgency: IntentUrgency,
  problemId: string | null,
): CategorySuggestion {
  return {
    categoryId: leaf.id,
    categorySlug: leaf.slug,
    labelEn: getLocalizedText(leaf.name, "en") || leaf.slug,
    labelAr: getLocalizedText(leaf.name, "ar") || leaf.slug,
    confidence,
    hypothesizedUrgency: urgency,
    problemId,
  };
}

export type IntentSuggestionBundle = {
  suggestion: CategorySuggestion | null;
  decision: AiDecision | null;
};

/**
 * Suggest a leaf category from free-text intent.
 * V2: full intent pipeline (structured AiDecision).
 * V1: knowledge → hybrid.
 * Off: hybrid only.
 */
export async function suggestCategoryFromIntent(
  intentText: string,
): Promise<CategorySuggestion | null> {
  const bundle = await suggestIntentIntelligence(intentText);
  return bundle.suggestion;
}

export async function suggestIntentIntelligence(
  intentText: string,
  opts?: { hasPhoto?: boolean; hasLocation?: boolean },
): Promise<IntentSuggestionBundle> {
  const trimmed = intentText.trim();
  if (trimmed.length < 8) return { suggestion: null, decision: null };

  const leaves = await getLeafCategories();

  if (isAiEngineV2Enabled()) {
    const decision = await runIntentPipeline({
      text: trimmed,
      hasPhoto: opts?.hasPhoto,
      hasLocation: opts?.hasLocation,
    });
    if (decision) {
      const leaf = leaves.find((c) => c.slug === decision.categorySlug);
      if (leaf) {
        return {
          decision,
          suggestion: leafSuggestion(
            leaf,
            decision.confidence,
            decision.marketplaceUrgency,
            decision.problemId,
          ),
        };
      }
    }
  } else if (isAiEngineV1Enabled()) {
    const resolved = await resolveIntentCategory(trimmed);
    if (resolved) {
      const leaf = leaves.find((c) => c.slug === resolved.categorySlug);
      if (leaf) {
        return {
          decision: null,
          suggestion: leafSuggestion(
            leaf,
            resolved.confidence,
            resolved.hypothesizedUrgency,
            resolved.problemId,
          ),
        };
      }
    }
  } else {
    const parsed = await hybridProblemDetector.detect(trimmed);
    if (parsed.problem) {
      const leaf = leaves.find((c) => c.slug === parsed.problem!.category);
      if (leaf) {
        return {
          decision: null,
          suggestion: leafSuggestion(
            leaf,
            parsed.problem.confidence,
            toUrgency(parsed.problem.priority),
            parsed.problem.problemId,
          ),
        };
      }
    }
  }

  const lower = trimmed.toLowerCase();
  for (const leaf of leaves) {
    const en = getLocalizedText(leaf.name, "en").toLowerCase();
    const ar = getLocalizedText(leaf.name, "ar");
    if (
      lower.includes(leaf.slug.replace(/_/g, " ")) ||
      (en && lower.includes(en)) ||
      (ar && trimmed.includes(ar))
    ) {
      return {
        decision: null,
        suggestion: leafSuggestion(leaf, 0.35, "normal", null),
      };
    }
  }

  return { suggestion: null, decision: null };
}
