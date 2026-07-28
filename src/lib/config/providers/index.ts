/**
 * Config-layer provider re-exports (Sprint 9.5 Phase 6).
 * Canonical implementation: `@/lib/providers`.
 */

export {
  resolveVisionProvider,
  resolveWhisperProvider,
  resolveForecastProvider,
  resolveChatProvider,
  PROVIDER_REGISTRY,
  isProviderImplemented,
} from "@/lib/providers";

export type {
  VisionProviderId,
  WhisperProviderId,
  OcrProviderId,
  ForecastProviderId,
  ChatProviderId,
  ProviderKind,
} from "@/lib/providers";
