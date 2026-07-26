/**
 * Matching module facade (Phase 1+2).
 * Marketplace matching stays in domains/matching; AI ranking is additive.
 */
export const matchingModule = {
  id: "matching",
  status: "phase2" as const,
  impl: [
    "src/domains/matching",
    "src/lib/search/learning",
    "src/lib/ai/provider",
    "src/lib/ai/matching/score.ts",
  ],
  future: ["travel ETA", "dialect-aware job routing"],
};
