/**
 * Mock LLM adapter — deterministic offline responses for tests / fail-closed.
 */

import type { LlmProvider, LlmCompleteInput } from "./types";
import type { AiCompletionResult } from "@/domains/ai/shared/types";

export class MockLlmProvider implements LlmProvider {
  readonly id = "mock" as const;

  async complete(input: LlmCompleteInput): Promise<AiCompletionResult> {
    const started = Date.now();
    const user = [...input.messages].reverse().find((m) => m.role === "user");
    const snippet = (user?.content ?? "").slice(0, 120);
    return {
      ok: true,
      content: JSON.stringify({
        advisory: true,
        summary: `Mock AI suggestion based on: ${snippet || "context"}`,
        bullets: [
          "This is a recommendation only.",
          "You remain in control of every action.",
        ],
        confidence: 0.4,
      }),
      providerId: "mock",
      model: "mock-v1",
      latencyMs: Date.now() - started,
      fallbackUsed: false,
    };
  }
}
