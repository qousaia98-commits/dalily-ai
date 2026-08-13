/**
 * SAD AI domain — Enterprise AI Platform (Sprint 10 Phase 5).
 * Runtime engines remain in src/lib/ai and specialized domains;
 * this facade orchestrates provider-agnostic access.
 */

export const AI_DOMAIN = {
  service: "ai",
  owns: [
    "ai_intent_memory",
    "ai_knowledge_phrases",
    "ai_intent_decisions",
    "ai_dispatch_predictions",
    "ai_provider_reputation",
    "ai_service_knowledge",
    "ai_job_analyses",
    "ai_vision_analyses",
    "ai_voice_transcripts",
    "ai_assistant_contexts",
    "ai_conversation_summaries",
    "ai_offer_comparisons",
    "ai_proactive_suggestions",
    "ai_demand_forecasts",
    "ai_availability_forecasts",
    "ai_wait_time_estimates",
    "ai_marketplace_balances",
    "ai_prediction_outcomes",
    "ai_predictive_notifications",
    "ai_automation_policies",
    "ai_provider_automation_settings",
    "ai_automation_actions",
    "ai_automation_approvals",
    "ai_automation_feedback",
    "ai_platform_usage",
    "ai_platform_cache",
    "ai_prompt_templates",
    "ai_moderation_reports",
    "ai_analytics_snapshots",
    "learning_events",
  ],
  impl: [
    "src/domains/ai",
    "src/domains/chat",
    "src/domains/vision",
    "src/domains/speech",
    "src/domains/forecast",
    "src/domains/matching",
    "src/domains/offer/recommendation",
    "src/lib/ai",
    "src/lib/fraud",
    "src/lib/ai-ops",
    "src/lib/pricing-engine",
    "src/lib/matching-engine",
    "src/lib/forecast-engine",
    "src/lib/scheduling-engine",
  ],
  status: "active",
  sprint: 10,
  featureFlag: "AI_PLATFORM",
  flags: [
    "AI_PLATFORM",
    "AI_ASSISTANT",
    "AI_TRANSLATION",
    "AI_PRICING",
    "AI_ANALYTICS",
    "AI_FRAUD",
    "AI_MODERATION",
  ],
} as const;

/** Stable pointers for intake / vision / voice orchestration. */
export const AI_IMPL_PATHS = AI_DOMAIN.impl;

export type {
  LlmProviderId,
  AiPlatformFeature,
  AiPriceEstimateView,
  AiTranslationView,
  AiSummaryView,
  AiFraudAnalysisView,
  AiModerationView,
  AiAssistantCapability,
  AiAssistantResponseView,
  AiPlatformHealthView,
  AiCompletionResult,
} from "@/domains/ai/shared/types";

export {
  resolveLlmProviderId,
  resolveFallbackLlmProviderId,
  getLlmProvider,
  listRegisteredLlmProviders,
  completeWithFallback,
} from "@/domains/ai/providers";

export {
  aiPlatformEngine,
  getAiPlatformStatus,
  getAiPlatformHealth,
} from "@/domains/ai/engine/platform-engine";

export {
  runCustomerAssistant,
  runProviderAssistant,
  buildCustomerAssistant,
  buildProviderAssistant,
} from "@/domains/ai/assistant/service";

export { estimatePriceRange } from "@/domains/ai/pricing/service";
export { translateText } from "@/domains/ai/translation/service";
export { analyzeEntityFraud } from "@/domains/ai/fraud/service";
export { recommendModeration } from "@/domains/ai/moderation/service";
export {
  summarizeConversation,
  summarizeArbitrary,
} from "@/domains/ai/analytics/summaries";
export { getMarketplaceInsightsOverview } from "@/domains/ai/analytics/insights";
export { queryKnowledge } from "@/domains/ai/knowledge/service";
export { suggestScheduleHints } from "@/domains/ai/scheduler/service";
export { getAiAdminCenterOverview } from "@/domains/ai/admin/overview";
