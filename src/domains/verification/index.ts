/**
 * SAD Verification domain facade (Sprint 0).
 */

export const VERIFICATION_DOMAIN = {
  service: "verification",
  owns: ["verification_cases", "verification_status"],
  impl: ["src/lib/verification"],
  status: "facade",
} as const;

export {
  resolveVerificationUiStatus,
  resolveVerificationFeedback,
  shouldShowVerificationDashboardAlert,
  isVerificationAlertRelevant,
  buildVerificationTimeline,
  type VerificationTimelineEventId,
  type VerificationTimelineEvent,
} from "@/lib/verification/status";
