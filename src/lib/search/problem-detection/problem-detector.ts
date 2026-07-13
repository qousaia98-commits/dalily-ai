import type { ParsedUserQuery } from "@/lib/search/engine/types";

/**
 * Contract for problem detection from natural language.
 * MVP: RuleBasedProblemDetector. Future: LlmProblemDetector with the same interface.
 */
export interface ProblemDetector {
  detect(raw: string): ParsedUserQuery;
}
