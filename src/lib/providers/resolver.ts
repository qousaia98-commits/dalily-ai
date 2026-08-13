/**
 * Canonical provider resolution (Sprint 9.5 Phase 6).
 * AI bridges and engines must call these helpers — not read env ad hoc.
 *
 * Behaviour: unimplemented provider IDs resolve to the current default
 * implementation (openai / supabase) so runtime stays identical.
 */

import { resolveEnv } from "@/lib/config/environment";
import type {
  ChatProviderId,
  ForecastProviderId,
  VisionProviderId,
  WhisperProviderId,
} from "./interfaces";

function normalize(raw: string | undefined): string {
  return (raw ?? "").trim().toLowerCase();
}

/** Canonical: OCR_PROVIDER (alias VISION_PROVIDER). Default openai. */
export function resolveVisionProvider(): VisionProviderId {
  const raw = normalize(resolveEnv("OCR_PROVIDER"));
  if (
    raw === "azure_openai" ||
    raw === "anthropic" ||
    raw === "gemini" ||
    raw === "local"
  ) {
    // Not implemented yet — keep runtime identical by using OpenAI path.
    return "openai";
  }
  return "openai";
}

/** Canonical: WHISPER_PROVIDER (alias SPEECH_PROVIDER / STT_PROVIDER). Default openai. */
export function resolveWhisperProvider(): WhisperProviderId {
  const raw = normalize(resolveEnv("WHISPER_PROVIDER"));
  if (raw === "azure_openai" || raw === "local") {
    return "openai";
  }
  return "openai";
}

/** Canonical: FORECAST_PROVIDER (alias PREDICTION_PROVIDER). Default openai. */
export function resolveForecastProvider(): ForecastProviderId {
  const raw = normalize(resolveEnv("FORECAST_PROVIDER"));
  if (raw === "local") return "openai";
  return "openai";
}

/** Canonical: CHAT_PROVIDER (alias MESSAGING_PROVIDER). Default supabase. */
export function resolveChatProvider(): ChatProviderId {
  const raw = normalize(resolveEnv("CHAT_PROVIDER"));
  if (raw === "local") return "supabase";
  return "supabase";
}
