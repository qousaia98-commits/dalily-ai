/**
 * AI / vision / speech / predictive feature flags.
 */

import { envFlag } from "./core";

/**
 * Sprint 7 Phase 2 — Ratings, Reviews & AI Reputation.
 * Multi-dim ratings, AI analysis, fake detection, reputation cache.
 * When false: legacy single-rating review flow still works.
 */
export function isReviewsReputationV2Enabled(): boolean {
  return (
    envFlag("REVIEWS_REPUTATION_V2") ||
    envFlag("REVIEWS_REPUTATION") ||
    envFlag("AI_REPUTATION_V1")
  );
}

/**
 * Sprint 7 Phase 3 — AI Reputation Engine (modular signals, trust levels, search boosts).
 * Defaults on when Phase 2 reputation flag is on.
 */
export function isAiReputationEngineEnabled(): boolean {
  return (
    envFlag("AI_REPUTATION_ENGINE") ||
    envFlag("AI_REPUTATION_ENGINE_V1") ||
    isReviewsReputationV2Enabled()
  );
}

/**
 * Sprint 7 Phase 4 — Quality Assurance & Case Management.
 */
export function isQualityCasesEnabled(): boolean {
  return (
    envFlag("QUALITY_CASES") ||
    envFlag("QUALITY_CASES_V1") ||
    envFlag("QA_CASE_MANAGEMENT")
  );
}

/**
 * Sprint 7 Phase 5 — Fraud Detection & Risk Intelligence (admin-only).
 */
export function isFraudDetectionEnabled(): boolean {
  return (
    envFlag("FRAUD_DETECTION") ||
    envFlag("FRAUD_DETECTION_V1") ||
    envFlag("RISK_INTELLIGENCE")
  );
}

/**
 * Sprint 7 Phase 6 — AI Operations & Platform Health (admin-only).
 */
export function isAiOpsEnabled(): boolean {
  return (
    envFlag("AI_OPS") ||
    envFlag("AI_OPS_V1") ||
    envFlag("PLATFORM_HEALTH") ||
    envFlag("AI_OPERATIONS")
  );
}

/**
 * Sprint 8 Phase 1 — AI Smart Matching Engine (modular weighted signals).
 * Canonical env: SMART_MATCHING_ENGINE.
 * Deprecated aliases (still accepted, same runtime OR): SMART_MATCHING_ENGINE_V1, AI_SMART_MATCHING.
 * When false: legacy AI match score in lib/ai/matching remains.
 */
export function isSmartMatchingEngineEnabled(): boolean {
  return (
    envFlag("SMART_MATCHING_ENGINE") ||
    /** @deprecated Use SMART_MATCHING_ENGINE */
    envFlag("SMART_MATCHING_ENGINE_V1") ||
    /** @deprecated Use SMART_MATCHING_ENGINE */
    envFlag("AI_SMART_MATCHING")
  );
}

/**
 * Sprint 8 Phase 2 — AI Dynamic Pricing & Market Intelligence.
 * Recommendations only — Dalily never forces provider prices.
 */
export function isAiDynamicPricingEnabled(): boolean {
  return (
    envFlag("AI_DYNAMIC_PRICING") ||
    envFlag("AI_DYNAMIC_PRICING_V1") ||
    envFlag("DYNAMIC_PRICING")
  );
}

/**
 * Sprint 8 Phase 3 — AI Demand Forecasting & Market Prediction.
 * Advisory forecasts only — never guarantees future outcomes.
 * @deprecated Prefer isForecastEngineEnabled() — aliases remain accepted.
 */
export function isAiDemandForecastingEnabled(): boolean {
  return (
    envFlag("AI_DEMAND_FORECASTING") ||
    envFlag("AI_DEMAND_FORECASTING_V1") ||
    envFlag("DEMAND_FORECASTING")
  );
}

/**
 * Canonical Forecast Engine flag.
 * FORECAST_ENGINE (canonical) OR legacy AI_DEMAND_FORECASTING aliases.
 */
export function isForecastEngineEnabled(): boolean {
  return envFlag("FORECAST_ENGINE") || isAiDemandForecastingEnabled();
}

/**
 * Forecast provider id (default openai — reserved; engine is currently signal/DB based).
 */
export function resolveForecastProviderFlag(): string {
  return (
    process.env.FORECAST_PROVIDER?.trim() ||
    process.env.PREDICTION_PROVIDER?.trim() ||
    "openai"
  );
}

/**
 * Sprint 8 Phase 4 — AI Scheduling, Capacity & Opportunity Planner.
 * Advisory recommendations only — providers always decide.
 */
export function isAiSchedulingEnabled(): boolean {
  return (
    envFlag("AI_SCHEDULING") ||
    envFlag("AI_SCHEDULING_V1") ||
    envFlag("AI_CAPACITY_OPTIMIZATION")
  );
}

/**
 * Sprint 8 Phase 5 — AI Business Assistant (coaching & insights).
 * Recommendations only — providers remain in control.
 */
export function isAiBusinessAssistantEnabled(): boolean {
  return (
    envFlag("AI_BUSINESS_ASSISTANT") ||
    envFlag("AI_BUSINESS_ASSISTANT_V1") ||
    envFlag("BUSINESS_ASSISTANT")
  );
}

/**
 * Sprint 8 Phase 6 — AI Marketplace Intelligence Platform.
 * Unified advisory intelligence; simulations never affect production.
 */
export function isAiMarketplaceIntelligenceEnabled(): boolean {
  return (
    envFlag("AI_MARKETPLACE_INTELLIGENCE") ||
    envFlag("AI_MARKETPLACE_INTELLIGENCE_V1") ||
    envFlag("MARKETPLACE_INTELLIGENCE")
  );
}

/**
 * AI Engine Phase 1 — knowledge lookup, intent memory, feedback loop.
 * Also true when Phase 2+ is on.
 */
export function isAiEngineV1Enabled(): boolean {
  return (
    envFlag("AI_ENGINE_V1") ||
    envFlag("AI_ENGINE_V2") ||
    envFlag("AI_ENGINE_V3") ||
    envFlag("AI_ENGINE_V4") ||
    envFlag("AI_ENGINE_V5") ||
    envFlag("AI_ENGINE_V6") ||
    envFlag("AI_ENGINE_V7") ||
    envFlag("AI_ENGINE_V8") ||
    envFlag("AI_ENGINE_V9")
  );
}

/**
 * AI Engine Phase 2 — full intent pipeline, smart questions, urgency/completeness,
 * AI provider match scores + explanations. Also true when Phase 3+ is on.
 */
export function isAiEngineV2Enabled(): boolean {
  return (
    envFlag("AI_ENGINE_V2") ||
    envFlag("AI_ENGINE_V3") ||
    envFlag("AI_ENGINE_V4") ||
    envFlag("AI_ENGINE_V5") ||
    envFlag("AI_ENGINE_V6") ||
    envFlag("AI_ENGINE_V7") ||
    envFlag("AI_ENGINE_V8") ||
    envFlag("AI_ENGINE_V9")
  );
}

/**
 * AI Engine Phase 3 — smart dispatch, capacity, route fit, ETA, response prediction,
 * marketplace exposure, reputation, continuous prediction learning.
 * Also true when Phase 4+ is on.
 */
export function isAiEngineV3Enabled(): boolean {
  return (
    envFlag("AI_ENGINE_V3") ||
    envFlag("AI_ENGINE_V4") ||
    envFlag("AI_ENGINE_V5") ||
    envFlag("AI_ENGINE_V6") ||
    envFlag("AI_ENGINE_V7") ||
    envFlag("AI_ENGINE_V8") ||
    envFlag("AI_ENGINE_V9")
  );
}

/**
 * AI Engine Phase 4 — job intelligence, service knowledge, tools/materials,
 * duration/price ranges, multi-service detection, provider prep summaries.
 * Also true when Phase 5+ is on.
 */
export function isAiEngineV4Enabled(): boolean {
  return (
    envFlag("AI_ENGINE_V4") ||
    envFlag("AI_ENGINE_V5") ||
    envFlag("AI_ENGINE_V6") ||
    envFlag("AI_ENGINE_V7") ||
    envFlag("AI_ENGINE_V8") ||
    envFlag("AI_ENGINE_V9")
  );
}

/**
 * AI Engine Phase 5 — Vision Intelligence.
 * Also true when Phase 6+ is on.
 * @deprecated Prefer isVisionEngineEnabled() — AI_ENGINE_V5 remains accepted.
 */
export function isAiEngineV5Enabled(): boolean {
  return (
    envFlag("AI_ENGINE_V5") ||
    envFlag("AI_ENGINE_V6") ||
    envFlag("AI_ENGINE_V7") ||
    envFlag("AI_ENGINE_V8") ||
    envFlag("AI_ENGINE_V9")
  );
}

/**
 * Canonical Vision Engine flag.
 * VISION_ENGINE (canonical) OR legacy AI_ENGINE_V5+ cascade — identical when only legacy flags set.
 */
export function isVisionEngineEnabled(): boolean {
  return envFlag("VISION_ENGINE") || isAiEngineV5Enabled();
}

/**
 * AI Engine Phase 6 — Voice Intelligence.
 * Also true when Phase 7+ is on.
 * @deprecated Prefer isSpeechEngineEnabled() — AI_ENGINE_V6 remains accepted.
 */
export function isAiEngineV6Enabled(): boolean {
  return (
    envFlag("AI_ENGINE_V6") ||
    envFlag("AI_ENGINE_V7") ||
    envFlag("AI_ENGINE_V8") ||
    envFlag("AI_ENGINE_V9")
  );
}

/**
 * Canonical Speech Engine flag.
 * SPEECH_ENGINE (canonical) OR legacy AI_ENGINE_V6+ cascade.
 */
export function isSpeechEngineEnabled(): boolean {
  return envFlag("SPEECH_ENGINE") || isAiEngineV6Enabled();
}

/**
 * OCR / Vision provider id (default openai). Reserved for multi-provider routing.
 * Does not change runtime until additional providers are implemented.
 */
export function resolveOcrProviderFlag(): string {
  return (
    process.env.OCR_PROVIDER?.trim() ||
    process.env.VISION_PROVIDER?.trim() ||
    "openai"
  );
}

/**
 * Whisper / STT provider id (default openai). Reserved for multi-provider routing.
 */
export function resolveWhisperProviderFlag(): string {
  return (
    process.env.WHISPER_PROVIDER?.trim() ||
    process.env.SPEECH_PROVIDER?.trim() ||
    process.env.STT_PROVIDER?.trim() ||
    "openai"
  );
}

/**
 * AI Engine Phase 7 — Personal AI Assistant & continuous intelligence.
 * Also true when Phase 8+ is on.
 */
export function isAiEngineV7Enabled(): boolean {
  return (
    envFlag("AI_ENGINE_V7") ||
    envFlag("AI_ENGINE_V8") ||
    envFlag("AI_ENGINE_V9")
  );
}

/**
 * AI Engine Phase 8 — Predictive Intelligence & autonomous optimization:
 * demand/availability forecasts, wait times, demand/supply balancer,
 * predictive notifications, market insights, admin AI dashboard, calibration.
 * Also true when Phase 9 is on.
 */
export function isAiEngineV8Enabled(): boolean {
  return envFlag("AI_ENGINE_V8") || envFlag("AI_ENGINE_V9");
}

/**
 * Canonical Predictive Intelligence flag (Phase 8 models).
 * PREDICTIVE_ENGINE (canonical) OR AI_ENGINE_V8+ cascade.
 */
export function isPredictiveEngineEnabled(): boolean {
  return envFlag("PREDICTIVE_ENGINE") || isAiEngineV8Enabled();
}

/**
 * AI Engine Phase 9 — Autonomous Actions & Workflow Automation:
 * workflow engine, confidence policy, customer/provider/admin automations,
 * audit, learning feedback, admin automation control center.
 */
export function isAiEngineV9Enabled(): boolean {
  return envFlag("AI_ENGINE_V9");
}

/**
 * Sprint 5 Phase 3 — AI Communication Assistant:
 * summaries, smart replies, translation, extraction, action items.
 * AI never auto-sends messages.
 */
export function isAiChatAssistantEnabled(): boolean {
  return (
    envFlag("AI_CHAT_ASSISTANT") ||
    envFlag("AI_CHAT_ASSISTANT_V1") ||
    envFlag("CHAT_AI_V1") ||
    isAiAssistantEnabled()
  );
}

/**
 * Sprint 10 Phase 5 — Enterprise AI Platform umbrella.
 * Canonical: AI_PLATFORM. Cascades from AI_ENGINE_V7+ / AI_OPS when unset.
 */
export function isAiPlatformEnabled(): boolean {
  return (
    envFlag("AI_PLATFORM") ||
    envFlag("AI_PLATFORM_V1") ||
    envFlag("ENTERPRISE_AI") ||
    isAiEngineV7Enabled() ||
    isAiOpsEnabled()
  );
}

/** Sprint 10 Phase 5 — Customer/Provider assistants (recommendations only). */
export function isAiAssistantEnabled(): boolean {
  return (
    isAiPlatformEnabled() &&
    (envFlag("AI_ASSISTANT") ||
      envFlag("AI_ASSISTANT_V1") ||
      isAiChatAssistantEnabledRaw() ||
      isAiBusinessAssistantEnabled() ||
      isAiEngineV7Enabled())
  );
}

/** Raw chat-assistant env without AI_ASSISTANT cascade (avoids recursion). */
function isAiChatAssistantEnabledRaw(): boolean {
  return (
    envFlag("AI_CHAT_ASSISTANT") ||
    envFlag("AI_CHAT_ASSISTANT_V1") ||
    envFlag("CHAT_AI_V1")
  );
}

/** Sprint 10 Phase 5 — Translation overlays (never overwrite originals). */
export function isAiTranslationEnabled(): boolean {
  return (
    isAiPlatformEnabled() &&
    (envFlag("AI_TRANSLATION") ||
      envFlag("AI_TRANSLATION_V1") ||
      isAiChatAssistantEnabledRaw())
  );
}

/** Sprint 10 Phase 5 — Pricing recommendations (never force prices). */
export function isAiPricingEnabled(): boolean {
  return (
    isAiPlatformEnabled() &&
    (envFlag("AI_PRICING") ||
      envFlag("AI_PRICING_V1") ||
      isAiDynamicPricingEnabled())
  );
}

/** Sprint 10 Phase 5 — Marketplace analytics / forecasts (advisory). */
export function isAiAnalyticsEnabled(): boolean {
  return (
    isAiPlatformEnabled() &&
    (envFlag("AI_ANALYTICS") ||
      envFlag("AI_ANALYTICS_V1") ||
      isForecastEngineEnabled() ||
      isAiMarketplaceIntelligenceEnabled() ||
      isAiOpsEnabled())
  );
}

/** Sprint 10 Phase 5 — Fraud analysis (never auto-ban). */
export function isAiFraudEnabled(): boolean {
  return (
    isAiPlatformEnabled() &&
    (envFlag("AI_FRAUD") || envFlag("AI_FRAUD_V1") || isFraudDetectionEnabled())
  );
}

/** Sprint 10 Phase 5 — Content moderation recommendations only. */
export function isAiModerationEnabled(): boolean {
  return (
    isAiPlatformEnabled() &&
    (envFlag("AI_MODERATION") ||
      envFlag("AI_MODERATION_V1") ||
      isAiFraudEnabled())
  );
}
