/**
 * Speech domain adapters — Speech Engine.
 */
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
  getVoiceByHash,
  upsertVoiceTranscript,
  attachVoiceToRequest,
  confirmVoiceTranscript,
  getLatestVoiceForRequest,
  getVoiceProviderPreview,
  compareVoiceTranscriptOutcome,
} from "@/lib/speech-engine";
