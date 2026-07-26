/**
 * Recommendations facade — workflow strategy + ranking engines.
 */
export const recommendationsModule = {
  id: "recommendations",
  status: "phase2" as const,
  impl: [
    "src/lib/ai/recommendations/workflow.ts",
    "src/lib/dalily-ranking/recommendation-engine.ts",
    "src/lib/search/smart-match",
  ],
  future: ["personalization from preferences"],
};

export { recommendWorkflow } from "./workflow";
