import { hybridProblemDetector } from "@/lib/search/problem-detection";
import { getLeafCategories } from "@/lib/categories/queries";
import { getLocalizedText } from "@/types/domain.types";
import type { CategorySuggestion, IntentUrgency } from "@/domains/customer/intent-types";

function toUrgency(priority: string | undefined): IntentUrgency {
  return priority === "emergency" ? "emergency" : "normal";
}

/**
 * Suggest a leaf category from free-text intent (rules + optional LLM).
 * Does not invent prices; does not publish.
 */
export async function suggestCategoryFromIntent(
  intentText: string,
): Promise<CategorySuggestion | null> {
  const trimmed = intentText.trim();
  if (trimmed.length < 8) return null;

  const parsed = await hybridProblemDetector.detect(trimmed);
  const leaves = await getLeafCategories();

  if (parsed.problem) {
    const leaf = leaves.find((c) => c.slug === parsed.problem!.category);
    if (leaf) {
      return {
        categoryId: leaf.id,
        categorySlug: leaf.slug,
        labelEn: getLocalizedText(leaf.name, "en") || leaf.slug,
        labelAr: getLocalizedText(leaf.name, "ar") || leaf.slug,
        confidence: parsed.problem.confidence,
        hypothesizedUrgency: toUrgency(parsed.problem.priority),
        problemId: parsed.problem.problemId,
      };
    }
  }

  // Weak fallback: keyword overlap with category slug/name
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
        categoryId: leaf.id,
        categorySlug: leaf.slug,
        labelEn: getLocalizedText(leaf.name, "en") || leaf.slug,
        labelAr: getLocalizedText(leaf.name, "ar") || leaf.slug,
        confidence: 0.35,
        hypothesizedUrgency: "normal",
        problemId: null,
      };
    }
  }

  return null;
}
