/**
 * Feature flags for Dalily 2.0 strangler migration.
 * Defaults are OFF so production behavior stays legacy until explicitly enabled.
 */

function envFlag(name: string): boolean {
  const raw = process.env[name];
  if (!raw) return false;
  return raw === "1" || raw.toLowerCase() === "true" || raw.toLowerCase() === "on";
}

/**
 * Sprint 1 — Marketplace domain read-model / projections.
 */
export function isMarketplaceDomainV2Enabled(): boolean {
  return envFlag("MARKETPLACE_DOMAIN_V2");
}

/**
 * Sprint 2 — Customer intent flow (intake → publish → waiting room).
 */
export function isCustomerIntentFlowV2Enabled(): boolean {
  return envFlag("CUSTOMER_INTENT_FLOW_V2");
}

/**
 * Sprint 3 — Matching engine (scarce pool + reason codes).
 * When false: publish does not create match_assignments.
 * Never reads subscription tier for eligibility/rank.
 */
export function isMatchingV2Enabled(): boolean {
  return envFlag("MATCHING_V2");
}

/**
 * Sprint 4 — Competing offers + customer select (no PII / chat release).
 * When false: legacy quotes path unchanged.
 * Offers must originate from match_assignments.
 */
export function isOffersV2Enabled(): boolean {
  return envFlag("OFFERS_V2");
}

/**
 * Sprint 5 — Unlock sessions, SLA, contact-release grants.
 * When false: selection stays pending_unlock with no session/grant.
 * Grant without a payment event only when UNLOCK_DEV_BYPASS is on (never for prod).
 */
export function isUnlockV2Enabled(): boolean {
  return envFlag("UNLOCK_V2");
}

/**
 * Dev-only: allow unlock success/grant without payment event.
 * Must remain off in production configuration.
 */
export function isUnlockDevBypassEnabled(): boolean {
  // Never allow grant-without-payment in any production config.
  if (process.env.DALILY_ENV === "production") return false;
  if (process.env.VERCEL_ENV === "production") return false;
  if (
    process.env.NODE_ENV === "production" &&
    process.env.VERCEL_ENV !== "preview"
  ) {
    return false;
  }
  return envFlag("UNLOCK_DEV_BYPASS");
}

/**
 * Sprint 6 — Unlock fee payment capture correlated to grants.
 * When false: Sprint 5 unlock surfaces stay (bypass/admin manual only).
 * When true: unlock grant requires verified server-side payment success
 * (admin approval rail or webhook), except UNLOCK_DEV_BYPASS.
 * Also freezes new subscription upgrade checkout.
 */
export function isUnlockPaymentsV2Enabled(): boolean {
  return envFlag("UNLOCK_PAYMENTS_V2");
}

/**
 * Sprint 6 Phase 1 — Provider Monetization:
 * FREE (AI pay-per-lead) vs BUSINESS ($20/mo, 10 included unlocks).
 */
export function isProviderMonetizationEnabled(): boolean {
  return (
    envFlag("PROVIDER_MONETIZATION") ||
    envFlag("PROVIDER_MONETIZATION_V1") ||
    envFlag("LEAD_MONETIZATION_V1")
  );
}

/**
 * Sprint 6 Phase 2 — Subscription & lead payment infrastructure
 * (history, status snapshots, canonical webhook events).
 * Defaults on when UNLOCK_PAYMENTS_V2 or PROVIDER_MONETIZATION is on.
 */
export function isPaymentInfrastructureEnabled(): boolean {
  return (
    envFlag("PAYMENT_INFRASTRUCTURE") ||
    envFlag("PAYMENT_INFRASTRUCTURE_V1") ||
    isUnlockPaymentsV2Enabled() ||
    isProviderMonetizationEnabled()
  );
}

/** Sprint 6 Phase 3 — Stripe live when provider=stripe and secret key set. */
export function isStripePaymentsEnabled(): boolean {
  return (
    (process.env.PAYMENT_PROVIDER ?? "manual").toLowerCase() === "stripe" &&
    Boolean(process.env.STRIPE_SECRET_KEY?.trim())
  );
}

/** Sprint 6 Phase 4 — automatic invoices/receipts PDF generation. */
export function isFinancialDocumentsEnabled(): boolean {
  return (
    envFlag("FINANCIAL_DOCUMENTS") ||
    envFlag("FINANCIAL_DOCUMENTS_V1") ||
    isPaymentInfrastructureEnabled()
  );
}

/**
 * Sprint 6 Phase 5 — Refunds & disputes (admin approval + Stripe + credit notes).
 * Defaults on when payment infrastructure is enabled.
 */
export function isRefundsDisputesEnabled(): boolean {
  return (
    envFlag("REFUNDS_DISPUTES") ||
    envFlag("REFUNDS_DISPUTES_V1") ||
    isPaymentInfrastructureEnabled()
  );
}

/**
 * Sprint 6 Phase 6 — Finance dashboard & revenue analytics (read-only).
 * Defaults on when payment infrastructure is enabled.
 */
export function isFinanceDashboardEnabled(): boolean {
  return (
    envFlag("FINANCE_DASHBOARD") ||
    envFlag("FINANCE_DASHBOARD_V1") ||
    isPaymentInfrastructureEnabled()
  );
}


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
 * Sprint 7 — Full chat only with contact_release_grants (scope includes chat).
 * When false: legacy status-based canChat() unchanged.
 * Q&A (offer_clarifications) stays pre-unlock either way.
 */
export function isChatAuthV2Enabled(): boolean {
  return envFlag("CHAT_AUTH_V2");
}

/**
 * Sprint 8 Phase 1 — AI Smart Matching Engine (modular weighted signals).
 * When false: legacy AI match score in lib/ai/matching remains.
 */
export function isSmartMatchingEngineEnabled(): boolean {
  return (
    envFlag("SMART_MATCHING_ENGINE") ||
    envFlag("SMART_MATCHING_ENGINE_V1") ||
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
 */
export function isAiDemandForecastingEnabled(): boolean {
  return (
    envFlag("AI_DEMAND_FORECASTING") ||
    envFlag("AI_DEMAND_FORECASTING_V1") ||
    envFlag("DEMAND_FORECASTING")
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
 * Sprint 8 — Provider dashboard: Unlock-first action stack, opportunities feed,
 * why-matched, offer-primary nav. When false: legacy Provider Success home.
 */
export function isProviderDashboardV2Enabled(): boolean {
  return envFlag("PROVIDER_DASHBOARD_V2");
}

/**
 * Sprint 9 — Admin economy/unlock/trust ops (cell policies, unlock queue, inspection, audited comps).
 * When false: legacy admin surfaces unchanged (subscription writes stay available).
 */
export function isAdminMigrationV2Enabled(): boolean {
  return envFlag("ADMIN_MIGRATION_V2");
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
 * AI Engine Phase 6 — Voice Intelligence.
 * Also true when Phase 7+ is on.
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
 * AI Engine Phase 9 — Autonomous Actions & Workflow Automation:
 * workflow engine, confidence policy, customer/provider/admin automations,
 * audit, learning feedback, admin automation control center.
 */
export function isAiEngineV9Enabled(): boolean {
  return envFlag("AI_ENGINE_V9");
}

/**
 * Sprint 4 Phase 1 — Dual Marketplace Experience:
 * publish-request vs find-provider entry points, AI path recommendation,
 * smart switching, enhanced provider search.
 */
export function isDualMarketplaceEnabled(): boolean {
  return envFlag("DUAL_MARKETPLACE") || envFlag("DUAL_MARKETPLACE_V1");
}

/**
 * Sprint 4 Phase 2 — Smart Booking & AI Scheduling:
 * live availability suggestions, travel buffer, reminders, day optimize, reschedule UX.
 */
export function isSmartBookingEnabled(): boolean {
  return envFlag("SMART_BOOKING") || envFlag("SMART_BOOKING_V1");
}

/**
 * Sprint 4 Phase 3 — Emergency Dispatch & Live Tracking:
 * bypass waiting, priority dispatch, live ETA/timeline, provider quick actions, admin monitor.
 */
export function isEmergencyDispatchEnabled(): boolean {
  return envFlag("EMERGENCY_DISPATCH") || envFlag("EMERGENCY_DISPATCH_V1");
}

/**
 * Sprint 4 Phase 4 — Multi-Service Projects & AI Project Coordination:
 * detect multi-trade jobs, parent project + packages, AI plan, matching per trade, dashboard.
 */
export function isMultiServiceProjectsEnabled(): boolean {
  return (
    envFlag("MULTI_SERVICE_PROJECTS") || envFlag("MULTI_SERVICE_PROJECTS_V1")
  );
}

/**
 * Sprint 4 Phase 5 — Recurring Services & Maintenance Plans:
 * recurring intervals, contracts, auto-scheduling, AI recommendations, reminders.
 */
export function isRecurringServicesEnabled(): boolean {
  return envFlag("RECURRING_SERVICES") || envFlag("RECURRING_SERVICES_V1");
}

/**
 * Sprint 5 Phase 1 — Real-Time Chat:
 * scoped conversations, reply/edit/pin, search, presence UI, learning events.
 * Complements CHAT_AUTH_V2 (authorization gate).
 */
export function isRealtimeChatEnabled(): boolean {
  return envFlag("REALTIME_CHAT") || envFlag("REALTIME_CHAT_V1");
}

/**
 * Sprint 5 Phase 2 — File Sharing & Media Collaboration:
 * multi-upload, previews, project galleries, AI media queue, storage quotas.
 */
export function isFileMediaSharingEnabled(): boolean {
  return (
    envFlag("FILE_MEDIA_SHARING") ||
    envFlag("FILE_MEDIA_SHARING_V1") ||
    envFlag("MEDIA_COLLAB")
  );
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
    envFlag("CHAT_AI_V1")
  );
}

/**
 * Sprint 5 Phase 4 — Voice Messages & Smart Voice Assistant:
 * record/send voice notes, STT, translate/summarize transcripts (no live calls).
 */
export function isChatVoiceMessagingEnabled(): boolean {
  return (
    envFlag("CHAT_VOICE_MESSAGING") ||
    envFlag("CHAT_VOICE_MESSAGING_V1") ||
    envFlag("VOICE_CHAT_V1")
  );
}

/**
 * Sprint 5 Phase 5 — Collaboration Workspace:
 * shared tasks, checklists, approvals, activity feed, AI project assistant.
 * AI never mutates project data automatically.
 */
export function isCollaborationWorkspaceEnabled(): boolean {
  return (
    envFlag("COLLABORATION_WORKSPACE") ||
    envFlag("COLLABORATION_WORKSPACE_V1") ||
    envFlag("PROJECT_WORKSPACE_V1")
  );
}

/**
 * Sprint 5 Phase 6 — Smart Notification Center:
 * unified inbox, priority, grouping, channels, preferences, AI digests.
 * AI may suggest priority only — never mutates business data.
 */
export function isSmartNotificationCenterEnabled(): boolean {
  return (
    envFlag("SMART_NOTIFICATION_CENTER") ||
    envFlag("SMART_NOTIFICATION_CENTER_V1") ||
    envFlag("NOTIFICATION_CENTER_V1")
  );
}

/**
 * Sprint 5.5 — Stabilization helpers are always on in app code;
 * no feature flag required. Use this marker for docs/CI only.
 */
export function isSprint55Stabilization(): boolean {
  return true;
}
