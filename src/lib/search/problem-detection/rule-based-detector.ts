import { normalizeSearchText } from "@/lib/search/engine/normalize";
import { PROBLEM_CATALOG } from "@/lib/search/engine/problem-catalog";
import type { DetectedProblem, ParsedUserQuery, ProblemId } from "@/lib/search/engine/types";
import type { ProblemDetector } from "@/lib/search/problem-detection/problem-detector";
import { detectCitySlug, stripCityTokens } from "@/lib/search/problem-detection/city-detector";

function scoreProblem(normalized: string, problemId: ProblemId): number {
  const definition = PROBLEM_CATALOG.find((item) => item.id === problemId);
  if (!definition) return 0;

  let score = 0;
  for (const keyword of definition.keywords) {
    const nk = normalizeSearchText(keyword);
    if (nk.length < 2) continue;
    if (normalized.includes(nk)) {
      score += nk.includes(" ") ? 5 : 1;
    }
  }
  return score;
}

function detectProblem(normalized: string): DetectedProblem | null {
  let best: { problem: DetectedProblem; score: number } | null = null;

  for (const definition of PROBLEM_CATALOG) {
    const score = scoreProblem(normalized, definition.id);
    if (score > 0 && (!best || score > best.score)) {
      best = {
        score,
        problem: {
          problemId: definition.id,
          priority: definition.priority,
          category: definition.category,
          confidence: Math.min(1, score / 10),
        },
      };
    }
  }

  return best?.problem ?? null;
}

function stripProblemTokens(normalized: string, problemId: ProblemId | null): string {
  if (!problemId) return normalized;

  const definition = PROBLEM_CATALOG.find((item) => item.id === problemId);
  let text = normalized;

  for (const keyword of definition?.keywords ?? []) {
    const nk = normalizeSearchText(keyword);
    if (nk.length >= 4) {
      text = text.replace(new RegExp(nk, "gi"), " ");
    }
  }

  return text.replace(/\s+/g, " ").trim();
}

export class RuleBasedProblemDetector implements ProblemDetector {
  async detect(raw: string): Promise<ParsedUserQuery> {
    const normalized = normalizeSearchText(raw);
    const citySlug = detectCitySlug(normalized);
    const withoutCity = stripCityTokens(normalized, citySlug);
    const problem = detectProblem(withoutCity);
    const textTerms = stripProblemTokens(withoutCity, problem?.problemId ?? null);

    return {
      raw: raw.trim(),
      normalized,
      problem,
      citySlug,
      textTerms,
    };
  }
}

export const ruleBasedProblemDetector = new RuleBasedProblemDetector();

export async function parseUserQuery(raw: string): Promise<ParsedUserQuery> {
  return ruleBasedProblemDetector.detect(raw);
}
