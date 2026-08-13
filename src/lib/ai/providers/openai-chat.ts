/**
 * OpenAI Chat Completions provider client (vision + text JSON).
 * Preserves existing request shapes used by search vision and intent vision.
 * HTTP timeout via shared `@/lib/api` (Sprint 9.5 Phase 6).
 */

import { fetchWithTimeout, jsonContentHeaders } from "@/lib/api";
import {
  resolveOpenAiApiKey,
  resolveOpenAiChatUrl,
  resolveVisionLlmModel,
} from "./openai-env";

export type OpenAiChatMessage = {
  role: "system" | "user" | "assistant";
  content:
    | string
    | Array<
        | { type: "text"; text: string }
        | { type: "image_url"; image_url: { url: string; detail?: "low" | "high" | "auto" } }
      >;
};

export type OpenAiChatCompletionInput = {
  messages: OpenAiChatMessage[];
  timeoutMs: number;
  temperature?: number;
  responseFormat?: { type: "json_object" };
  model?: string;
  apiUrl?: string;
  logPrefix?: string;
};

export type OpenAiChatCompletionResult =
  | { ok: true; content: string }
  | { ok: false; error: "no_api_key" | "request_failed" };

export async function openaiChatCompletion(
  input: OpenAiChatCompletionInput,
): Promise<OpenAiChatCompletionResult> {
  const apiKey = resolveOpenAiApiKey();
  if (!apiKey) {
    return { ok: false, error: "no_api_key" };
  }

  const apiUrl = input.apiUrl ?? resolveOpenAiChatUrl();
  const model = input.model ?? resolveVisionLlmModel();
  const logPrefix = input.logPrefix ?? "[ai.providers.openai-chat]";

  const result = await fetchWithTimeout(apiUrl, {
    method: "POST",
    timeoutMs: input.timeoutMs,
    headers: jsonContentHeaders(apiKey),
    body: JSON.stringify({
      model,
      temperature: input.temperature ?? 0,
      ...(input.responseFormat
        ? { response_format: input.responseFormat }
        : {}),
      messages: input.messages,
    }),
  });

  if (!result.ok) {
    if (result.error === "http") {
      console.error(
        `${logPrefix} OpenAI failed (${result.status}):`,
        result.bodyPreview ?? "",
      );
    } else {
      console.error(`${logPrefix} threw:`, result.error);
    }
    return { ok: false, error: "request_failed" };
  }

  try {
    const payload = (await result.response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = payload.choices?.[0]?.message?.content ?? "";
    return { ok: true, content };
  } catch (error) {
    console.error(`${logPrefix} threw:`, error);
    return { ok: false, error: "request_failed" };
  }
}
