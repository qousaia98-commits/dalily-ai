/**
 * SAD Unlock domain — sessions, SLA, contact-release grants (Sprint 5).
 * @see docs/migration/sprint-5-notes.md
 */

export const UNLOCK_DOMAIN = {
  service: "unlock",
  owns: ["unlock_sessions", "contact_release_grants", "unlock_reliability_signals"],
  impl: ["src/domains/unlock"],
  status: "active",
  sprint: 5,
  featureFlag: "UNLOCK_V2",
} as const;

export {
  CONTACT_RELEASE_DEFAULT_SCOPE,
  UNLOCK_SESSION_STATUSES,
  getUnlockFeeSnapshot,
  getUnlockSlaHours,
  type ContactReleaseGrantView,
  type ReleasedContact,
  type UnlockSessionStatus,
  type UnlockSessionView,
} from "@/domains/unlock/types";

export {
  openUnlockSessionForSelection,
  getUnlockSessionForSelection,
  getUnlockSessionById,
  listProviderUnlockSessions,
  completeUnlockSuccess,
  declineUnlockSession,
} from "@/domains/unlock/session";

export {
  applyUnlockFallback,
  processUnlockSlaTimeouts,
} from "@/domains/unlock/fallback";

export {
  getContactReleaseGrantForRequest,
  getReleasedContactForCustomer,
  hasContactReleaseGrant,
} from "@/domains/unlock/contact-gate";

export {
  stubUnlockPaymentPort,
  unlockPaymentPort,
  completeUnlockFromPaymentCapture,
  type UnlockPaymentCaptureEvent,
  type UnlockPaymentPort,
} from "@/domains/unlock/payment-port";
