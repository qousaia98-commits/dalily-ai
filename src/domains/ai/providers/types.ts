/**
 * LLM Provider port — business/AI features must never import vendor SDKs.
 */

import type {
  AiCompletionMessage,
  AiCompletionResult,
  LlmProviderId,
} from "@/domains/ai/shared/types";

export type LlmCompleteInput = {
  messages: AiCompletionMessage[];
  temperature?: number;
  timeoutMs?: number;
  model?: string;
  jsonMode?: boolean;
  feature?: string;
};

export interface LlmProvider {
  readonly id: LlmProviderId;
  complete(input: LlmCompleteInput): Promise<AiCompletionResult>;
}
