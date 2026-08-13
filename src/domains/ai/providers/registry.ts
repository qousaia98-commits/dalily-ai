/**
 * LLM provider registry — resolve primary + fallback without vendor coupling.
 */

import { OpenAiCompatibleLlmProvider } from "./openai-compatible.provider";
import { MockLlmProvider } from "./mock.provider";
import { StubLlmProvider } from "./stub.provider";
import type { LlmProvider } from "./types";
import type { LlmProviderId } from "@/domains/ai/shared/types";

const mock = new MockLlmProvider();
const openai = new OpenAiCompatibleLlmProvider("openai");
const azure = new OpenAiCompatibleLlmProvider("azure_openai", {
  apiUrl: process.env.AZURE_OPENAI_CHAT_URL,
  model: process.env.AZURE_OPENAI_DEPLOYMENT ?? "gpt-4o-mini",
});
const openrouter = new OpenAiCompatibleLlmProvider("openrouter", {
  apiUrl: process.env.OPENROUTER_API_URL ?? "https://openrouter.ai/api/v1/chat/completions",
  model: process.env.OPENROUTER_MODEL ?? "openai/gpt-4o-mini",
});

const stubs: Record<string, LlmProvider> = {
  anthropic: new StubLlmProvider("anthropic"),
  gemini: new StubLlmProvider("gemini"),
  self_hosted: new StubLlmProvider("self_hosted"),
  local: new StubLlmProvider("local"),
};

export function resolveLlmProviderId(
  override?: string | null,
): LlmProviderId {
  const raw = (
    override ??
    process.env.LLM_PROVIDER ??
    process.env.AI_LLM_PROVIDER ??
    "openai"
  )
    .trim()
    .toLowerCase();

  switch (raw) {
    case "openai":
    case "anthropic":
    case "gemini":
    case "azure_openai":
    case "azure":
    case "openrouter":
    case "self_hosted":
    case "local":
    case "mock":
      return raw === "azure" ? "azure_openai" : (raw as LlmProviderId);
    default:
      return "openai";
  }
}

export function resolveFallbackLlmProviderId(): LlmProviderId {
  return resolveLlmProviderId(
    process.env.LLM_FALLBACK_PROVIDER ?? process.env.AI_LLM_FALLBACK ?? "mock",
  );
}

export function getLlmProvider(id?: LlmProviderId | string | null): LlmProvider {
  const key = resolveLlmProviderId(id);
  switch (key) {
    case "openai":
      return openai;
    case "azure_openai":
      return azure;
    case "openrouter":
      return openrouter;
    case "mock":
      return mock;
    case "anthropic":
    case "gemini":
    case "self_hosted":
    case "local":
      return stubs[key] ?? mock;
    default:
      return mock;
  }
}

export function listRegisteredLlmProviders(): LlmProviderId[] {
  return [
    "openai",
    "anthropic",
    "gemini",
    "azure_openai",
    "openrouter",
    "self_hosted",
    "local",
    "mock",
  ];
}
