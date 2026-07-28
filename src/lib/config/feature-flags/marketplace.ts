/**
 * Marketplace & platform collaboration feature flags.
 */

import { envFlag } from "./core";

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
 * Sprint 7 — Full chat only with contact_release_grants (scope includes chat).
 * When false: legacy status-based canChat() unchanged.
 * Q&A (offer_clarifications) stays pre-unlock either way.
 */
/**
 * Sprint 7 — Chat Authorization (grant-gated full chat).
 * @deprecated Prefer isChatEngineEnabled() — CHAT_AUTH_V2 remains accepted.
 */
export function isChatAuthV2Enabled(): boolean {
  return envFlag("CHAT_AUTH_V2");
}

/**
 * Canonical Chat Engine flag.
 * CHAT_ENGINE (canonical) OR legacy CHAT_AUTH_V2.
 */
export function isChatEngineEnabled(): boolean {
  return envFlag("CHAT_ENGINE") || isChatAuthV2Enabled();
}

/**
 * Canonical Messaging Engine flag (inbox / list layer).
 * MESSAGING_ENGINE OR CHAT_ENGINE cascade.
 */
export function isMessagingEngineEnabled(): boolean {
  return envFlag("MESSAGING_ENGINE") || isChatEngineEnabled();
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
 * @deprecated Prefer isRealtimeEngineEnabled() — aliases remain accepted.
 */
export function isRealtimeChatEnabled(): boolean {
  return envFlag("REALTIME_CHAT") || envFlag("REALTIME_CHAT_V1");
}

/**
 * Canonical Realtime Engine flag.
 * REALTIME_ENGINE (canonical) OR legacy REALTIME_CHAT aliases.
 */
export function isRealtimeEngineEnabled(): boolean {
  return envFlag("REALTIME_ENGINE") || isRealtimeChatEnabled();
}

/**
 * Chat provider id (default supabase — reserved for future multi-provider routing).
 */
export function resolveChatProviderFlag(): string {
  return (
    process.env.CHAT_PROVIDER?.trim() ||
    process.env.MESSAGING_PROVIDER?.trim() ||
    "supabase"
  );
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
