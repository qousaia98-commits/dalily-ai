/**
 * Canonical provider infrastructure (Sprint 9.5 Phase 6).
 */

export type {
  ChatProviderId,
  ForecastProviderId,
  OcrProviderId,
  ProviderKind,
  VisionProviderId,
  WhisperProviderId,
} from "./interfaces";

export { PROVIDER_REGISTRY, isProviderImplemented } from "./registry";

export {
  resolveVisionProvider,
  resolveWhisperProvider,
  resolveForecastProvider,
  resolveChatProvider,
} from "./resolver";
