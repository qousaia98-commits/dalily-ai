import type { ParsedUserQuery } from "@/lib/search/engine/types";

/**
 * Contract for problem detection from natural language.
 * HybridProblemDetector (rule-based fast path + LlmProblemDetector fallback)
 * is the default in production; RuleBasedProblemDetector remains available
 * standalone for offline/deterministic verification.
 */
export interface ProblemDetector {
  detect(raw: string): Promise<ParsedUserQuery>;
}
