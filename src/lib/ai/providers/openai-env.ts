/** Shared OpenAI env resolution — used by chat + whisper providers. */

export function resolveOpenAiApiKey(): string | null {
  const key = process.env.SEARCH_LLM_API_KEY ?? process.env.OPENAI_API_KEY;
  return key?.trim() ? key : null;
}

export function resolveOpenAiChatUrl(): string {
  return (
    process.env.SEARCH_LLM_API_URL ?? "https://api.openai.com/v1/chat/completions"
  );
}

export function resolveVisionLlmModel(): string {
  return process.env.VISION_LLM_MODEL ?? process.env.SEARCH_LLM_MODEL ?? "gpt-4o-mini";
}

export function resolveWhisperModel(fallback = "whisper-1"): string {
  return process.env.VOICE_STT_MODEL ?? fallback;
}

export function resolveOpenAiTranscriptionUrl(): string {
  return (
    process.env.OPENAI_TRANSCRIPTIONS_URL ??
    "https://api.openai.com/v1/audio/transcriptions"
  );
}
