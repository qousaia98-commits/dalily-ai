/**
 * Client-safe Speech public surface.
 * Browser recorder + preview types — no server STT.
 */

export {
  VoiceRecorder,
  VoiceRecorderError,
  MAX_RECORDING_MS,
  MAX_CHAT_VOICE_RECORDING_MS,
  type VoiceRecorderErrorReason,
} from "@/lib/voice/recorder";

export type {
  VoiceLanguageCode,
  VoiceDialectCode,
  VoiceLanguageDetection,
  MultimodalFusionResult,
  VoiceProviderPreview,
  VoicePipelineResult,
} from "@/domains/speech/types";
