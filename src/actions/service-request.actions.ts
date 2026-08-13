/**
 * Stable public entry for service-request server actions.
 * Implementation lives in `./service-request/*` (Sprint 9.5 Phase 7).
 *
 * Client Components must import from `./service-request/<module>` (files with
 * `"use server"`). Re-export barrels are not valid Client Action entry points
 * under Next.js 15 — see Sprint 9.6 RC1 regression fix.
 *
 * Server Components may use this barrel or the modular paths.
 */

export type { ServiceRequestActionState } from "./service-request/types";

export { createServiceRequestAction } from "./service-request/create";
export { acceptServiceRequestAction } from "./service-request/assign";
export { rejectServiceRequestAction } from "./service-request/cancel";
export {
  sendQuoteAction,
  acceptQuoteAction,
  declineQuoteAction,
  requestQuoteChangesAction,
  completeServiceAction,
  confirmCompletionAction,
  reportProblemAction,
  submitReviewAction,
} from "./service-request/status";
export { saveProviderRequestSettingsAction } from "./service-request/update";
export {
  sendMessageAction,
  markNotificationReadAction,
} from "./service-request/notifications";
