/**
 * AI Engine Phase 6 — Voice Intelligence.
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
    "src/lib/ai/voice/pipeline.ts",
    "src/lib/ai/voice/stt.ts",
    "src/lib/voice/recorder.ts",
  ],
  future: ["on-device STT", "realtime streaming transcription"],
};
