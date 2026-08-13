/**
 * OpenAI Whisper / audio transcriptions provider client.
 * Single Whisper fetch wrapper for search voice + intent STT + chat voice.
 * HTTP timeout via shared `@/lib/api` (Sprint 9.5 Phase 6).
 */

import { bearerAuthHeaders, fetchWithTimeout } from "@/lib/api";
import {
  resolveOpenAiApiKey,
  resolveOpenAiTranscriptionUrl,
  resolveWhisperModel,
} from "./openai-env";

export type OpenAiAudioTranscriptionInput = {
  /** Audio blob/file body */
  file: Blob;
  fileName: string;
  timeoutMs: number;
  /** Defaults to VOICE_STT_MODEL ?? whisper-1 */
  model?: string;
  responseFormat?: "verbose_json" | "json" | "text";
  logPrefix?: string;
};

export type OpenAiAudioTranscriptionResult =
  | {
      ok: true;
      text: string;
      language: string | null;
    }
  | {
      ok: false;
      error: "no_api_key" | "request_failed" | "empty_transcript";
    };

export async function openaiAudioTranscription(
  input: OpenAiAudioTranscriptionInput,
): Promise<OpenAiAudioTranscriptionResult> {
  const apiKey = resolveOpenAiApiKey();
  if (!apiKey) {
    return { ok: false, error: "no_api_key" };
  }

  const model = input.model ?? resolveWhisperModel("whisper-1");
  const responseFormat = input.responseFormat ?? "verbose_json";
  const apiUrl = resolveOpenAiTranscriptionUrl();
  const logPrefix = input.logPrefix ?? "[ai.providers.openai-whisper]";

  const openaiForm = new FormData();
  openaiForm.set("file", input.file, input.fileName);
  openaiForm.set("model", model);
  openaiForm.set("response_format", responseFormat);

  const result = await fetchWithTimeout(apiUrl, {
    method: "POST",
    timeoutMs: input.timeoutMs,
    headers: bearerAuthHeaders(apiKey),
    body: openaiForm,
  });

  if (!result.ok) {
    if (result.error === "http") {
      console.error(
        `${logPrefix} Whisper failed (${result.status}):`,
        result.bodyPreview ?? "",
      );
    } else {
      console.error(`${logPrefix} threw:`, result.error);
    }
    return { ok: false, error: "request_failed" };
  }

  try {
    if (responseFormat === "text") {
      const text = (await result.response.text()).trim();
      if (!text) return { ok: false, error: "empty_transcript" };
      return { ok: true, text, language: null };
    }

    const payload = (await result.response.json()) as {
      text?: string;
      language?: string;
    };
    const text = payload.text?.trim();
    if (!text) {
      return { ok: false, error: "empty_transcript" };
    }

    return {
      ok: true,
      text,
      language: payload.language ?? null,
    };
  } catch (error) {
    console.error(`${logPrefix} threw:`, error);
    return { ok: false, error: "request_failed" };
  }
}
