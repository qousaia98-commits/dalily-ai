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
 * Sprint 7 — Full chat only with contact_release_grants (scope includes chat).
 * When false: legacy status-based canChat() unchanged.
 * Q&A (offer_clarifications) stays pre-unlock either way.
 */
export function isChatAuthV2Enabled(): boolean {
  return envFlag("CHAT_AUTH_V2");
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
