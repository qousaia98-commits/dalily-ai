/**
 * Speech Engine STT — Whisper via shared provider client.
 */

import { VOICE_STT_TIMEOUT_MS } from "./validate";
import { openaiAudioTranscription } from "@/lib/ai/providers";
import { resolveWhisperModel } from "@/lib/ai/providers/openai-env";

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
  /** Override timeout (search voice action uses 15s; default engine uses 20s). */
  timeoutMs?: number;
  /** Override model (search voice hardcodes whisper-1). */
  model?: string;
  logPrefix?: string;
}): Promise<SpeechToTextResult> {
  const blob = new Blob([input.bytes], { type: input.mimeType });
  const result = await openaiAudioTranscription({
    file: blob,
    fileName: input.fileName || guessFileName(input.mimeType),
    timeoutMs: input.timeoutMs ?? VOICE_STT_TIMEOUT_MS,
    model: input.model ?? resolveWhisperModel("whisper-1"),
    responseFormat: "verbose_json",
    logPrefix: input.logPrefix ?? "[ai.voice.stt]",
  });

  if (!result.ok) {
    return { success: false, error: result.error };
  }

  return {
    success: true,
    text: result.text,
    language: result.language,
  };
}

function guessFileName(mime: string): string {
  if (mime.includes("ogg")) return "voice.ogg";
  if (mime.includes("mp4") || mime.includes("m4a")) return "voice.m4a";
  if (mime.includes("mpeg") || mime.includes("mp3")) return "voice.mp3";
  if (mime.includes("wav")) return "voice.wav";
  return "voice.webm";
}
