/**
 * AI matching façade metadata only — no business logic.
 * Runtime orchestration: domains/matching → matching-engine (or legacy score when flag off).
 */
export const matchingModule = {
  id: "matching",
  status: "phase2" as const,
  impl: [
    "src/domains/matching (public API)",
    "src/lib/matching-engine (runtime when SMART_MATCHING_ENGINE)",
    "src/lib/ai/matching/score.ts (legacy path when flag off)",
  ],
  responsibilities: ["facade", "featureFlags", "mlRouting", "telemetry"] as const,
  future: ["travel ETA", "dialect-aware job routing", "external ML ranker"],
};
