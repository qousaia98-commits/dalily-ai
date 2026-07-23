import { normalizeSearchText } from "@/lib/search/engine/normalize";
import { categoryForProblem, priorityForProblem } from "@/lib/search/engine/problem-catalog";
import type { DetectedProblem, ParsedUserQuery, ProblemId } from "@/lib/search/engine/types";
import type { ProblemDetector } from "@/lib/search/problem-detection/problem-detector";
import { detectCitySlug, stripCityTokens } from "@/lib/search/problem-detection/city-detector";

/** Closed set the model is allowed to answer with — never trust free text back. */
const PROBLEM_GLOSSARY: Record<ProblemId, string> = {
  water_leak: "water leak or plumbing issue (pipe, sink, faucet, toilet)",
  power_outage: "electrical issue or power outage (no electricity, faulty wiring, broken light/lamp)",
  ac_not_cooling: "air conditioning / HVAC not cooling or not working",
  locked_out: "locked out of home or car, lost key, broken lock — needs a locksmith",
  appliance_leak: "home appliance broken or leaking (washing machine, dishwasher, fridge, dryer)",
  medical_need: "needs to see a doctor or medical clinic",
  legal_need: "needs a lawyer or legal advice",
  vehicle_repair: "car or vehicle mechanical repair",
  cleaning_need: "needs a home or office cleaner",
  dental_need: "dental problem, needs a dentist",
  pharmacy_need: "needs medicine or a pharmacy",
  tutoring_need: "needs a tutor or private lessons",
  restaurant_need: "looking for a restaurant or food",
  it_support_need: "computer, laptop, or wifi/IT problem",
  photography_need: "needs a photographer or photo shoot",
};

const PROBLEM_IDS = Object.keys(PROBLEM_GLOSSARY) as ProblemId[];
const PROBLEM_ID_SET = new Set<string>(PROBLEM_IDS);

const REQUEST_TIMEOUT_MS = 3500;
/** Fixed, conservative — below a solid rule-based phrase match on purpose. */
const LLM_CONFIDENCE = 0.6;

function buildSystemPrompt(): string {
  const lines = PROBLEM_IDS.map((id) => `- ${id}: ${PROBLEM_GLOSSARY[id]}`).join("\n");
  return [
    "You classify a local-services search query — spoken or typed, in any language or mix of languages — into exactly one category id.",
    "Categories:",
    lines,
    'Reply with exactly one category id from the list above, or "none" if nothing fits. No punctuation, quotes, or explanation — only the id.',
  ].join("\n");
}

function parseModelReply(content: string | undefined): ProblemId | null {
  if (!content) return null;
  const cleaned = content.trim().toLowerCase().replace(/[^a-z_]/g, "");
  if (cleaned === "none" || !cleaned) return null;
  return PROBLEM_ID_SET.has(cleaned) ? (cleaned as ProblemId) : null;
}

/**
 * LLM-backed fallback for free-form phrasing, typos, non-catalog languages
 * (e.g. German), and code-switched input the rule-based catalog can't match.
 * Fails soft on any error — never throws into the search pipeline.
 */
export class LlmProblemDetector implements ProblemDetector {
  async detect(raw: string): Promise<ParsedUserQuery> {
    const trimmed = raw.trim();
    const normalized = normalizeSearchText(raw);
    const citySlug = detectCitySlug(normalized);
    const textTerms = stripCityTokens(normalized, citySlug);

    const problem = trimmed ? await this.classify(trimmed) : null;

    return { raw: trimmed, normalized, problem, citySlug, textTerms };
  }

  private async classify(text: string): Promise<DetectedProblem | null> {
    const apiKey = process.env.SEARCH_LLM_API_KEY ?? process.env.OPENAI_API_KEY;
    if (!apiKey) return null;

    const apiUrl =
      process.env.SEARCH_LLM_API_URL ?? "https://api.openai.com/v1/chat/completions";
    const model = process.env.SEARCH_LLM_MODEL ?? "gpt-4o-mini";

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          temperature: 0,
          messages: [
            { role: "system", content: buildSystemPrompt() },
            { role: "user", content: text },
          ],
        }),
        signal: controller.signal,
      });

      if (!response.ok) return null;

      const payload = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const problemId = parseModelReply(payload.choices?.[0]?.message?.content);
      if (!problemId) return null;

      return {
        problemId,
        category: categoryForProblem(problemId),
        priority: priorityForProblem(problemId),
        confidence: LLM_CONFIDENCE,
      };
    } catch {
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }
}

export const llmProblemDetector = new LlmProblemDetector();
