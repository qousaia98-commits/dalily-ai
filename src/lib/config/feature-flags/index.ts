/**
 * Canonical feature-flags public API (Sprint 9.5 Phase 6).
 * Import from `@/lib/config/feature-flags` — same surface as the former monolith.
 *
 * Defaults remain OFF so production behavior stays legacy until explicitly enabled.
 */

export { envFlag, isUnlockDevBypassEnabled } from "./core";

export {
  isMarketplaceDomainV2Enabled,
  isCustomerIntentFlowV2Enabled,
  isMatchingV2Enabled,
  isOffersV2Enabled,
  isOfferDecisionEngineEnabled,
  isUnlockV2Enabled,
  isChatAuthV2Enabled,
  isChatEngineEnabled,
  isMessagingEngineEnabled,
  isEnterpriseCommunicationEnabled,
  isProviderDashboardV2Enabled,
  isAdminMigrationV2Enabled,
  isDualMarketplaceEnabled,
  isDirectSearchV1Enabled,
  isSmartBookingEnabled,
  isEmergencyDispatchEnabled,
  isMultiServiceProjectsEnabled,
  isRecurringServicesEnabled,
  isRealtimeChatEnabled,
  isRealtimeEngineEnabled,
  resolveChatProviderFlag,
  isFileMediaSharingEnabled,
  isChatVoiceMessagingEnabled,
  isCollaborationWorkspaceEnabled,
  isSmartNotificationCenterEnabled,
} from "./marketplace";

export {
  isUnlockPaymentsV2Enabled,
  isProviderMonetizationEnabled,
  isPaymentInfrastructureEnabled,
  isStripePaymentsEnabled,
  isFinancialDocumentsEnabled,
  isRefundsDisputesEnabled,
  isFinanceDashboardEnabled,
  isPaymentsV2Enabled,
  isPaymentWalletEnabled,
  isEscrowEngineEnabled,
  isPayoutsEnabled,
} from "./payments";

export {
  isReviewsReputationV2Enabled,
  isAiReputationEngineEnabled,
  isQualityCasesEnabled,
  isFraudDetectionEnabled,
  isAiOpsEnabled,
  isSmartMatchingEngineEnabled,
  isAiDynamicPricingEnabled,
  isAiDemandForecastingEnabled,
  isForecastEngineEnabled,
  resolveForecastProviderFlag,
  isAiSchedulingEnabled,
  isAiBusinessAssistantEnabled,
  isAiMarketplaceIntelligenceEnabled,
  isAiEngineV1Enabled,
  isAiEngineV2Enabled,
  isAiEngineV3Enabled,
  isAiEngineV4Enabled,
  isAiEngineV5Enabled,
  isVisionEngineEnabled,
  isAiEngineV6Enabled,
  isSpeechEngineEnabled,
  resolveOcrProviderFlag,
  resolveWhisperProviderFlag,
  isAiEngineV7Enabled,
  isAiEngineV8Enabled,
  isPredictiveEngineEnabled,
  isAiEngineV9Enabled,
  isAiChatAssistantEnabled,
  isAiPlatformEnabled,
  isAiAssistantEnabled,
  isAiTranslationEnabled,
  isAiPricingEnabled,
  isAiAnalyticsEnabled,
  isAiFraudEnabled,
  isAiModerationEnabled,
} from "./ai";

export { isSprint55Stabilization } from "./experimental";
