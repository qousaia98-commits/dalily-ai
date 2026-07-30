/**
 * OpenAI-compatible chat adapter (also covers Azure/OpenRouter URL overrides).
 */

import { openaiChatCompletion } from "@/lib/ai/providers/openai-chat";
import type { LlmProvider, LlmCompleteInput } from "./types";
import type { AiCompletionResult, LlmProviderId } from "@/domains/ai/shared/types";

export class OpenAiCompatibleLlmProvider implements LlmProvider {
  readonly id: LlmProviderId;
  private readonly apiUrl?: string;
  private readonly defaultModel: string;

  constructor(id: LlmProviderId, opts?: { apiUrl?: string; model?: string }) {
    this.id = id;
    this.apiUrl = opts?.apiUrl;
    this.defaultModel = opts?.model ?? "gpt-4o-mini";
  }

  async complete(input: LlmCompleteInput): Promise<AiCompletionResult> {
    const started = Date.now();
    const result = await openaiChatCompletion({
      messages: input.messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      timeoutMs: input.timeoutMs ?? 12_000,
      temperature: input.temperature ?? 0.3,
      model: input.model ?? this.defaultModel,
      apiUrl: this.apiUrl,
      responseFormat: input.jsonMode ? { type: "json_object" } : undefined,
      logPrefix: `[ai.llm.${this.id}]`,
    });

    if (!result.ok) {
      return {
        ok: false,
        error: result.error,
        providerId: this.id,
        fallbackUsed: false,
      };
    }

    return {
      ok: true,
      content: result.content,
      providerId: this.id,
      model: input.model ?? this.defaultModel,
      latencyMs: Date.now() - started,
      fallbackUsed: false,
    };
  }
}
