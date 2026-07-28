/**
 * Speech Engine barrel — INTERNAL runtime (STT + voice intelligence pipeline).
 * Implementation modules live under `src/lib/ai/voice/*`.
 * External consumers: `@/domains/speech`.
 *
 * @see docs/architecture/speech.md
 */

export { speechToText } from "@/lib/ai/voice/stt";
export type { SpeechToTextResult } from "@/lib/ai/voice/stt";
export { runVoiceIntelligencePipeline } from "@/lib/ai/voice/pipeline";
export { fuseVoiceTextImage } from "@/lib/ai/voice/fusion";
export { buildSmartTranscript } from "@/lib/ai/voice/normalize";
export { detectVoiceLanguage, detectVoiceDialect } from "@/lib/ai/voice/language";
export {
  validateVoiceAudio,
  contentHashFromAudio,
  VOICE_MAX_AUDIO_BYTES,
  VOICE_STT_TIMEOUT_MS,
  isAllowedVoiceMime,
} from "@/lib/ai/voice/validate";
export {
  getVoiceByHash,
  upsertVoiceTranscript,
  attachVoiceToRequest,
  confirmVoiceTranscript,
  getLatestVoiceForRequest,
  getVoiceProviderPreview,
} from "@/lib/ai/voice/cache";
export { compareVoiceTranscriptOutcome } from "@/lib/ai/voice/learning";
export type {
  VoiceLanguageCode,
  VoiceDialectCode,
  VoiceLanguageDetection,
  SmartTranscript,
  VoiceInterpretation,
  MultimodalFusionResult,
  VoicePipelineResult,
  VoiceProviderPreview,
} from "@/lib/ai/voice/types";
