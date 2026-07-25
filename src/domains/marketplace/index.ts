/**
 * SAD Marketplace domain (Sprint 1).
 * Owns request lifecycle projections + selection placeholders.
 * Legacy RFQ writes remain in src/lib/service-requests + actions until later sprints.
 * @see docs/architecture/sad-boundaries.md
 * @see docs/migration/sprint-1-notes.md
 */

export const MARKETPLACE_DOMAIN = {
  service: "marketplace",
  owns: ["requests", "selections", "job_checkpoints", "request_projections"],
  impl: ["src/domains/marketplace", "src/lib/service-requests (legacy ACL)"],
  status: "owner_with_legacy_acl",
  legacy: true,
  sprint: 1,
} as const;

export {
  MARKETPLACE_LIFECYCLE_PHASES,
  JOB_CHECKPOINT_IDS,
  type MarketplaceLifecyclePhase,
  type JobCheckpointId,
} from "@/domains/marketplace/lifecycle";

export {
  mapLegacyStatusToLifecyclePhase,
  mapLifecyclePhaseToJobCheckpoint,
} from "@/domains/marketplace/legacy-map";

export type {
  MarketplaceRequestMeta,
  MarketplaceSelectionPlaceholder,
} from "@/domains/marketplace/types";

export {
  buildMarketplaceMetaFromLegacy,
  syncMarketplaceRequestProjection,
} from "@/domains/marketplace/projection";

export {
  attachMarketplaceReadModel,
  attachMarketplaceReadModels,
  afterLegacyMarketplaceWrite,
} from "@/domains/marketplace/repository";

export { isMarketplaceDomainV2Enabled } from "@/lib/config/feature-flags";

/** Legacy status machine still exported for UI until Sprint 7 chat cutover. */
export {
  TIMELINE_STEPS,
  canChat,
  canReview,
  canCompleteService,
  canSendQuote,
  canDecideQuote,
  canConfirmCompletion,
  isTerminal,
  nextStepHint,
  buildTimeline,
  BUSINESS_REQUEST_TABS,
  statusesForTab,
  type ServiceRequestStatus,
  type TimelineStepId,
  type TimelineStepState,
  type TimelineStep,
  type BusinessRequestTab,
} from "@/lib/service-requests/status-machine";
