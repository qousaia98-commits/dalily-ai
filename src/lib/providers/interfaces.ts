/**
 * Provider capability interfaces (Sprint 9.5 Phase 6).
 */

export type VisionProviderId =
  | "openai"
  | "azure_openai"
  | "anthropic"
  | "gemini"
  | "local";

export type WhisperProviderId = "openai" | "azure_openai" | "local";

export type OcrProviderId = VisionProviderId;

export type ForecastProviderId = "openai" | "local";

export type ChatProviderId = "supabase" | "local";

export type ProviderKind =
  | "vision"
  | "ocr"
  | "whisper"
  | "speech"
  | "forecast"
  | "chat"
  | "messaging";
