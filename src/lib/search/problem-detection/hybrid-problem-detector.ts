import type { ParsedUserQuery } from "@/lib/search/engine/types";
import type { ProblemDetector } from "@/lib/search/problem-detection/problem-detector";
import { ruleBasedProblemDetector } from "@/lib/search/problem-detection/rule-based-detector";
import { llmProblemDetector } from "@/lib/search/problem-detection/llm-problem-detector";

/**
 * Rule-based confidence = min(1, score/10). A multi-word phrase match alone
 * scores 5 (confidence 0.5) and clears this; a single bare keyword scores 1
 * (confidence 0.1) and does not — so the LLM fallback only fires for weak or
 * unmatched input (paraphrasing, typos, other languages, code-switching).
 */
const RULE_CONFIDENCE_THRESHOLD = 0.4;

/**
 * Default production detector: free, instant rule-based match first;
 * LLM fallback only when the rule-based match is weak or absent.
 */
export class HybridProblemDetector implements ProblemDetector {
  constructor(
    private readonly rule: ProblemDetector = ruleBasedProblemDetector,
    private readonly llm: ProblemDetector = llmProblemDetector,
  ) {}

  async detect(raw: string): Promise<ParsedUserQuery> {
    const ruleResult = await this.rule.detect(raw);
    if (ruleResult.problem && ruleResult.problem.confidence >= RULE_CONFIDENCE_THRESHOLD) {
      return ruleResult;
    }

    const llmResult = await this.llm.detect(raw);
    if (llmResult.problem) return llmResult;

    return ruleResult;
  }
}

export const hybridProblemDetector = new HybridProblemDetector();
