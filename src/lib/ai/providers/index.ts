/**
 * Shared AI provider client — Sprint 9.5 Phase 3 / Phase 6.
 *
 * Provider *selection* is centralized in `@/lib/providers`.
 * This module re-exports resolvers and OpenAI HTTP implementations.
 */

export type {
  VisionProviderId,
  WhisperProviderId,
  OcrProviderId,
} from "@/lib/providers";

export {
  resolveVisionProvider,
  resolveWhisperProvider,
} from "@/lib/providers";

export {
  resolveOpenAiApiKey,
  resolveOpenAiChatUrl,
  resolveVisionLlmModel,
} from "./openai-env";
export { openaiChatCompletion } from "./openai-chat";
export { openaiAudioTranscription } from "./openai-whisper";
export type {
  OpenAiChatCompletionInput,
  OpenAiChatCompletionResult,
} from "./openai-chat";
export type {
  OpenAiAudioTranscriptionInput,
  OpenAiAudioTranscriptionResult,
} from "./openai-whisper";
