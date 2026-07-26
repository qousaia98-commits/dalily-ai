/**
 * Audio validation + content hash for Voice pipeline.
 */

import { createHash } from "node:crypto";

export const VOICE_MAX_AUDIO_BYTES = 1.5 * 1024 * 1024;
export const VOICE_ALLOWED_MIME_PREFIXES = [
  "audio/webm",
  "audio/ogg",
  "audio/mp4",
  "audio/mpeg",
  "audio/wav",
] as const;
export const VOICE_STT_TIMEOUT_MS = 20_000;

export type ValidateVoiceAudioResult =
  | {
      ok: true;
      bytes: ArrayBuffer;
      mimeType: string;
      byteSize: number;
    }
  | {
      ok: false;
      error: "empty" | "too_large" | "invalid_type";
    };

export function isAllowedVoiceMime(mimeType: string): boolean {
  const mime = (mimeType || "").toLowerCase();
  return VOICE_ALLOWED_MIME_PREFIXES.some((p) => mime.startsWith(p));
}

/**
 * Validate MIME/size. Noise reduction is applied client-side via getUserMedia
 * constraints (echoCancellation / noiseSuppression) — no server DSP dependency.
 */
export function validateVoiceAudio(input: {
  bytes: ArrayBuffer;
  mimeType: string;
}): ValidateVoiceAudioResult {
  const mime = (input.mimeType || "audio/webm").toLowerCase();
  if (!isAllowedVoiceMime(mime)) {
    return { ok: false, error: "invalid_type" };
  }
  if (!input.bytes || input.bytes.byteLength === 0) {
    return { ok: false, error: "empty" };
  }
  if (input.bytes.byteLength > VOICE_MAX_AUDIO_BYTES) {
    return { ok: false, error: "too_large" };
  }
  return {
    ok: true,
    bytes: input.bytes,
    mimeType: mime,
    byteSize: input.bytes.byteLength,
  };
}

export function contentHashFromAudio(bytes: ArrayBuffer): string {
  return createHash("sha256").update(Buffer.from(bytes)).digest("hex");
}
