/**
 * Contextual quick-suggestion chips for intent intake.
 * Keys resolve under `intentFlow.suggestions.contextual.*`.
 * Category slugs match hybridProblemDetector / leaf categories
 * (electrical, plumbing, painting, carpentry, hvac).
 */

const GENERAL_KEYS = [
  "contextual.general.g1",
  "contextual.general.g2",
  "contextual.general.g3",
  "contextual.general.g4",
] as const;

const BY_CATEGORY: Record<string, readonly string[]> = {
  electrical: [
    "contextual.electrical.e1",
    "contextual.electrical.e2",
    "contextual.electrical.e3",
    "contextual.electrical.e4",
    "contextual.electrical.e5",
  ],
  plumbing: [
    "contextual.plumbing.p1",
    "contextual.plumbing.p2",
    "contextual.plumbing.p3",
    "contextual.plumbing.p4",
    "contextual.plumbing.p5",
  ],
  painting: [
    "contextual.painting.a1",
    "contextual.painting.a2",
    "contextual.painting.a3",
    "contextual.painting.a4",
  ],
  carpentry: [
    "contextual.carpentry.c1",
    "contextual.carpentry.c2",
    "contextual.carpentry.c3",
    "contextual.carpentry.c4",
  ],
  hvac: [
    "contextual.hvac.h1",
    "contextual.hvac.h2",
    "contextual.hvac.h3",
    "contextual.hvac.h4",
  ],
};

/** Normalize detector / DB slugs onto the mapping keys above. */
function normalizeCategorySlug(slug: string): string {
  const s = slug.trim().toLowerCase().replace(/\s+/g, "_");
  if (
    s === "air_conditioning" ||
    s === "air-conditioning" ||
    s === "ac" ||
    s === "aircon" ||
    s === "conditioning"
  ) {
    return "hvac";
  }
  if (s === "painter" || s === "paint") return "painting";
  if (s === "carpenter" || s === "woodwork") return "carpentry";
  if (s === "electrician" || s === "electric") return "electrical";
  if (s === "plumber" || s === "pipes") return "plumbing";
  return s;
}

/**
 * Message keys for chips given a detected category slug.
 * No slug / unknown slug → general suggestions only.
 */
export function getContextualSuggestionKeys(
  categorySlug: string | null | undefined,
): readonly string[] {
  if (!categorySlug) return GENERAL_KEYS;
  const key = normalizeCategorySlug(categorySlug);
  return BY_CATEGORY[key] ?? GENERAL_KEYS;
}

export const CONTEXTUAL_SUGGESTION_CATEGORIES = Object.keys(BY_CATEGORY);
