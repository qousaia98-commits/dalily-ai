/**
 * Stub adapters for vendors not yet wired — fail soft to mock/fallback.
 */

import type { LlmProvider, LlmCompleteInput } from "./types";
import type { AiCompletionResult, LlmProviderId } from "@/domains/ai/shared/types";
import { MockLlmProvider } from "./mock.provider";

export class StubLlmProvider implements LlmProvider {
  readonly id: LlmProviderId;
  private readonly fallback = new MockLlmProvider();

  constructor(id: LlmProviderId) {
    this.id = id;
  }

  async complete(input: LlmCompleteInput): Promise<AiCompletionResult> {
    // Reserved for Anthropic / Gemini / self-hosted SDKs.
    // Until configured, use mock so features stay available offline.
    const result = await this.fallback.complete(input);
    if (result.ok) {
      return { ...result, providerId: this.id, fallbackUsed: true };
    }
    return {
      ok: false,
      error: `${this.id}_not_configured`,
      providerId: this.id,
      fallbackUsed: true,
    };
  }
}
