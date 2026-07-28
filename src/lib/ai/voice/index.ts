/**
 * AI Speech / Voice Bridge (thin) — INTERNAL.
 *
 * Speech Engine runtime: `src/lib/speech-engine` (re-exports modules here).
 * External consumers MUST use `@/domains/speech`.
 *
 * @see docs/architecture/speech.md
 */

export type {
  VoiceLanguageCode,
  VoiceDialectCode,
  VoiceLanguageDetection,
  SmartTranscript,
  VoiceInterpretation,
  MultimodalFusionResult,
  VoicePipelineResult,
  VoiceProviderPreview,
} from "./types";

export { runVoiceIntelligencePipeline } from "./pipeline";
export { fuseVoiceTextImage } from "./fusion";
export { speechToText } from "./stt";
export { buildSmartTranscript } from "./normalize";
export { detectVoiceLanguage, detectVoiceDialect } from "./language";
export {
  validateVoiceAudio,
  contentHashFromAudio,
  VOICE_MAX_AUDIO_BYTES,
  isAllowedVoiceMime,
} from "./validate";
export {
  getVoiceByHash,
  upsertVoiceTranscript,
  attachVoiceToRequest,
  confirmVoiceTranscript,
  getLatestVoiceForRequest,
  getVoiceProviderPreview,
} from "./cache";
export { compareVoiceTranscriptOutcome } from "./learning";

export const voiceModule = {
  id: "voice",
  status: "phase6" as const,
  impl: [
    "src/domains/speech (public API)",
    "src/lib/speech-engine (runtime engine)",
    "src/lib/ai/voice (bridge modules)",
    "src/lib/ai/providers (shared Whisper client)",
    "src/lib/voice/recorder.ts (browser capture)",
  ],
  responsibilities: ["facade", "featureFlags", "providerRouting", "telemetry"] as const,
  future: ["on-device STT", "realtime streaming transcription", "multi-provider STT"],
};

/** Alias for architecture docs — same façade as voiceModule. */
export const speechModule = voiceModule;
