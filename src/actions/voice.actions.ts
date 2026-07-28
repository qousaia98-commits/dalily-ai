"use server";

/**
 * Public voice-search transcription — no auth gate, matches location.actions.ts.
 * The audio never touches Supabase Storage or disk: it exists only as the
 * incoming request file and the outgoing multipart body to OpenAI, both
 * discarded when this function returns. Do not add a Storage upload here.
 *
 * STT transport: shared speech engine (@/domains/speech → Whisper provider).
 * Validation limits and error codes preserved exactly.
 */

import { speechToText } from "@/domains/speech";

const MAX_AUDIO_BYTES = 1.5 * 1024 * 1024;
const ALLOWED_AUDIO_PREFIXES = ["audio/webm", "audio/ogg", "audio/mp4"];
const REQUEST_TIMEOUT_MS = 15_000;

export type TranscribeVoiceQueryResult =
  | { success: true; text: string; language: string | null }
  | {
      success: false;
      error: "no_audio" | "file_too_large" | "invalid_file_type" | "transcription_failed";
    };

function isAllowedAudioType(mimeType: string): boolean {
  return ALLOWED_AUDIO_PREFIXES.some((prefix) => mimeType.startsWith(prefix));
}

export async function transcribeVoiceQueryAction(
  formData: FormData,
): Promise<TranscribeVoiceQueryResult> {
  const file = formData.get("audio");

  if (!(file instanceof File) || file.size === 0) {
    console.error("[voice] rejected: no audio file in FormData (or empty)");
    return { success: false, error: "no_audio" };
  }
  if (file.size > MAX_AUDIO_BYTES) {
    console.error(`[voice] rejected: file too large (${file.size} bytes > ${MAX_AUDIO_BYTES})`);
    return { success: false, error: "file_too_large" };
  }
  if (file.type && !isAllowedAudioType(file.type)) {
    console.error(`[voice] rejected: unsupported mime type "${file.type}"`);
    return { success: false, error: "invalid_file_type" };
  }

  const bytes = await file.arrayBuffer();
  const stt = await speechToText({
    bytes,
    mimeType: file.type || "audio/webm",
    fileName: file.name || "audio.webm",
    timeoutMs: REQUEST_TIMEOUT_MS,
    model: "whisper-1",
    logPrefix: "[voice]",
  });

  if (!stt.success) {
    if (stt.error === "no_api_key") {
      console.error(
        "[voice] transcription skipped: no SEARCH_LLM_API_KEY/OPENAI_API_KEY configured",
      );
    }
    return { success: false, error: "transcription_failed" };
  }

  return { success: true, text: stt.text, language: stt.language };
}
