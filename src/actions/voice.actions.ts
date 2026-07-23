"use server";

/**
 * Public voice-search transcription — no auth gate, matches location.actions.ts.
 * The audio never touches Supabase Storage or disk: it exists only as the
 * incoming request file and the outgoing multipart body to OpenAI, both
 * discarded when this function returns. Do not add a Storage upload here.
 */

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
    return { success: false, error: "no_audio" };
  }
  if (file.size > MAX_AUDIO_BYTES) {
    return { success: false, error: "file_too_large" };
  }
  if (file.type && !isAllowedAudioType(file.type)) {
    return { success: false, error: "invalid_file_type" };
  }

  const apiKey = process.env.SEARCH_LLM_API_KEY ?? process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return { success: false, error: "transcription_failed" };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const openaiForm = new FormData();
    openaiForm.set("file", file, file.name || "audio.webm");
    openaiForm.set("model", "whisper-1");
    openaiForm.set("response_format", "verbose_json");

    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: openaiForm,
      signal: controller.signal,
    });

    if (!response.ok) {
      return { success: false, error: "transcription_failed" };
    }

    const payload = (await response.json()) as { text?: string; language?: string };
    const text = payload.text?.trim();
    if (!text) {
      return { success: false, error: "transcription_failed" };
    }

    return { success: true, text, language: payload.language ?? null };
  } catch {
    return { success: false, error: "transcription_failed" };
  } finally {
    clearTimeout(timeout);
  }
}
