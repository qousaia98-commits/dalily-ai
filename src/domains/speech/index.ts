/**
 * SAD Speech domain — canonical public entry (Sprint 9.5 Phase 3).
 *
 * UI / Actions / Pages → @/domains/speech → speech-engine → Whisper provider
 *
 * `"use client"` modules must import from `@/domains/speech/client`.
 *
 * @see docs/architecture/speech.md
 */

export const SPEECH_DOMAIN = {
  service: "speech",
  owns: ["ai_voice_transcripts", "chat_voice_transcripts"],
  impl: [
    "src/domains/speech",
    "src/lib/speech-engine (runtime)",
    "src/lib/ai/voice (bridge modules)",
    "src/lib/ai/providers (Whisper client)",
    "src/lib/voice/recorder (browser)",
  ],
  status: "active",
  sprint: "9.5",
  featureFlag: "SPEECH_ENGINE",
  legacyAliasFlags: ["AI_ENGINE_V6", "CHAT_VOICE_MESSAGING"],
} as const;

export {
  speechToText,
  runVoiceIntelligencePipeline,
  fuseVoiceTextImage,
  buildSmartTranscript,
  detectVoiceLanguage,
  detectVoiceDialect,
  validateVoiceAudio,
  contentHashFromAudio,
  VOICE_MAX_AUDIO_BYTES,
  VOICE_STT_TIMEOUT_MS,
  isAllowedVoiceMime,
  confirmVoiceTranscript,
  attachVoiceToRequest,
  getLatestVoiceForRequest,
  getVoiceProviderPreview,
  compareVoiceTranscriptOutcome,
  getVoiceByHash,
  upsertVoiceTranscript,
} from "@/domains/speech/adapters/engine";

export { voiceModule, speechModule } from "@/domains/speech/adapters/ai-bridge";

export type {
  SpeechToTextResult,
  ValidateVoiceAudioResult,
  VoiceLanguageCode,
  VoiceDialectCode,
  VoiceLanguageDetection,
  SmartTranscript,
  VoiceInterpretation,
  MultimodalFusionResult,
  VoicePipelineResult,
  VoiceProviderPreview,
} from "@/domains/speech/types";
