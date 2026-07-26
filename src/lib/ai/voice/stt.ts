/**
 * Speech-to-text via OpenAI Whisper (verbose_json for language).
 */

import {
  VOICE_STT_TIMEOUT_MS,
} from "./validate";

export type SpeechToTextResult =
  | {
      success: true;
      text: string;
      language: string | null;
    }
  | {
      success: false;
      error: "no_api_key" | "request_failed" | "empty_transcript";
    };

export async function speechToText(input: {
  bytes: ArrayBuffer;
  mimeType: string;
  fileName?: string;
}): Promise<SpeechToTextResult> {
  const apiKey = process.env.SEARCH_LLM_API_KEY ?? process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return { success: false, error: "no_api_key" };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), VOICE_STT_TIMEOUT_MS);

  try {
    const blob = new Blob([input.bytes], { type: input.mimeType });
    const openaiForm = new FormData();
    openaiForm.set(
      "file",
      blob,
      input.fileName || guessFileName(input.mimeType),
    );
    openaiForm.set("model", process.env.VOICE_STT_MODEL ?? "whisper-1");
    openaiForm.set("response_format", "verbose_json");

    const response = await fetch(
      "https://api.openai.com/v1/audio/transcriptions",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}` },
        body: openaiForm,
        signal: controller.signal,
      },
    );

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      console.error(`[ai.voice.stt] Whisper failed (${response.status}):`, body.slice(0, 400));
      return { success: false, error: "request_failed" };
    }

    const payload = (await response.json()) as {
      text?: string;
      language?: string;
    };
    const text = payload.text?.trim();
    if (!text) {
      return { success: false, error: "empty_transcript" };
    }

    return {
      success: true,
      text,
      language: payload.language ?? null,
    };
  } catch (error) {
    console.error("[ai.voice.stt] threw:", error);
    return { success: false, error: "request_failed" };
  } finally {
    clearTimeout(timeout);
  }
}

function guessFileName(mime: string): string {
  if (mime.includes("ogg")) return "voice.ogg";
  if (mime.includes("mp4") || mime.includes("m4a")) return "voice.m4a";
  if (mime.includes("mpeg") || mime.includes("mp3")) return "voice.mp3";
  if (mime.includes("wav")) return "voice.wav";
  return "voice.webm";
}
