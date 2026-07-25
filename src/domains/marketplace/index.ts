/**
 * SAD Marketplace domain facade (Sprint 0).
 * Current impl is LEGACY accept→chat RFQ — rewrite begins Sprint 1.
 * @see docs/migration/legacy-inventory.md
 */

export const MARKETPLACE_DOMAIN = {
  service: "marketplace",
  owns: ["requests", "selections", "job_checkpoints"],
  impl: ["src/lib/service-requests"],
  status: "facade_over_legacy",
  legacy: true,
} as const;

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
