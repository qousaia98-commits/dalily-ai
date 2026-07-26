/**
 * Pricing module — Phase 4 market range estimates (never fixed prices).
 */
export const pricingModule = {
  id: "pricing",
  status: "phase4" as const,
  impl: ["src/lib/ai/jobs/catalog.ts", "src/lib/ai/jobs/analyze.ts"],
  future: ["city multipliers", "seasonality", "historical offer blends"],
};
